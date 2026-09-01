import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { QueryResultRow } from "pg";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";

export const NOT_FOUND_MESSAGE = "No order found with that ID.";

const AUTH_ERROR_MESSAGE = "You're not logged in, so I can't look that up. Please log in and try again.";

type ToolResult = Record<string, unknown>;

function authError(): ToolResult {
  return { error: "AUTH_REQUIRED", message: AUTH_ERROR_MESSAGE };
}

function invalidInput(message: string): ToolResult {
  return { error: "INVALID_INPUT", message };
}

function formatAmount(amount: string | number): string {
  return `$${Number(amount).toFixed(2)}`;
}

const QUERY_TIMEOUT_MS = 5000;

/** Races lib/db.ts's query() against a timeout — every query these tools run goes through this. */
function queryWithTimeout<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return Promise.race([
    query<T>(sql, params),
    new Promise<T[]>((_, reject) => {
      setTimeout(() => reject(new Error("Database query timed out")), QUERY_TIMEOUT_MS);
    }),
  ]);
}

// orders.created_at and audit_log postdate the original seed and aren't
// guaranteed to exist yet — both statements are idempotent, so this is safe
// to run every cold start and cheap once cached for the process lifetime.
let schemaReady: Promise<void> | null = null;
function ensureToolsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await queryWithTimeout(
        "alter table orders add column if not exists created_at timestamptz not null default now()",
      );
      await queryWithTimeout(`
        create table if not exists audit_log (
          id serial primary key,
          order_id text not null,
          customer_id integer not null,
          action text not null,
          source text not null,
          created_at timestamptz not null default now()
        )
      `);
    })();
  }
  return schemaReady;
}

// No user id, customer id, phone, or email ever appears in these schemas —
// the caller can only ever name which order it wants, never whose.
const emptyInputSchema = z.object({}).strict();
const orderIdInputSchema = z.object({
  orderId: z.coerce.string().trim().min(1),
});

type OrderRow = {
  id: string;
  status: string;
  items: string;
  total_amount: string;
  created_at: string;
};

function isCancellable(status: string): boolean {
  return status !== "delivered" && status !== "cancelled";
}

/** Reads the logged-in customer's most recent orders — no id required. */
export async function listMyOrders(input: unknown): Promise<ToolResult> {
  const session = await getSession();
  if (!session) return authError();

  const parsed = emptyInputSchema.safeParse(input ?? {});
  if (!parsed.success) return invalidInput("This tool takes no input.");

  await ensureToolsSchema();

  const rows = await queryWithTimeout<OrderRow>(
    `select id, created_at, status, items, total_amount
     from orders
     where customer_id = $1
     order by created_at desc, id desc
     limit 5`,
    [session.customerId],
  );

  return {
    orders: rows.map((row) => ({
      orderId: row.id,
      date: row.created_at,
      status: row.status,
      summary: row.items,
      amount: formatAmount(row.total_amount),
    })),
  };
}

/** Reads full detail for one of the logged-in customer's own orders. */
export async function getOrderDetails(input: unknown): Promise<ToolResult> {
  const session = await getSession();
  if (!session) return authError();

  const parsed = orderIdInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput("orderId is required.");
  const { orderId } = parsed.data;

  await ensureToolsSchema();

  // The owner check lives in the WHERE clause, sourced from the session —
  // an order belonging to someone else simply doesn't match this query.
  const rows = await queryWithTimeout<OrderRow>(
    `select id, created_at, status, items, total_amount
     from orders
     where id = $1 and customer_id = $2`,
    [orderId, session.customerId],
  );
  if (rows.length === 0) return { error: "NOT_FOUND", message: NOT_FOUND_MESSAGE };

  const order = rows[0];
  return {
    orderId: order.id,
    summary: order.items,
    status: order.status,
    date: order.created_at,
    amount: formatAmount(order.total_amount),
    cancellable: isCancellable(order.status),
  };
}

/** Reads the refund state linked to one of the logged-in customer's own orders. */
export async function getRefundStatus(input: unknown): Promise<ToolResult> {
  const session = await getSession();
  if (!session) return authError();

  const parsed = orderIdInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput("orderId is required.");
  const { orderId } = parsed.data;

  const orderRows = await queryWithTimeout<{ id: string }>(
    "select id from orders where id = $1 and customer_id = $2",
    [orderId, session.customerId],
  );
  if (orderRows.length === 0) return { error: "NOT_FOUND", message: NOT_FOUND_MESSAGE };

  const refundRows = await queryWithTimeout<{
    status: string;
    amount: string;
    reason: string | null;
    created_at: string;
  }>(
    `select status, amount, reason, created_at
     from refunds
     where order_id = $1 and customer_id = $2
     order by id desc
     limit 1`,
    [orderId, session.customerId],
  );
  if (refundRows.length === 0) {
    return {
      orderId,
      refundStatus: "none",
      message: "No refund has been requested for this order.",
    };
  }

  const refund = refundRows[0];
  return {
    orderId,
    refundStatus: refund.status,
    amount: formatAmount(refund.amount),
    reason: refund.reason,
    updatedAt: refund.created_at,
  };
}

/** Cancels one of the logged-in customer's own orders. The only writer here. */
export async function cancelOrder(input: unknown): Promise<ToolResult> {
  const session = await getSession();
  if (!session) return authError();

  const parsed = orderIdInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput("orderId is required.");
  const { orderId } = parsed.data;

  await ensureToolsSchema();

  // Re-checked here against the database, never trusted from upstream: the
  // order must belong to this session's customer and must not yet be
  // delivered.
  const rows = await queryWithTimeout<{ id: string; status: string }>(
    "select id, status from orders where id = $1 and customer_id = $2",
    [orderId, session.customerId],
  );
  if (rows.length === 0) return { error: "NOT_FOUND", message: NOT_FOUND_MESSAGE };

  const order = rows[0];

  // Idempotent: a repeat call after a successful cancel returns the same
  // success without writing again.
  if (order.status === "cancelled") {
    return {
      success: true,
      orderId,
      status: "cancelled",
      message: "This order is already canceled.",
    };
  }

  if (!isCancellable(order.status)) {
    return {
      success: false,
      orderId,
      status: order.status,
      message: "This order has already been delivered, so it can no longer be canceled.",
    };
  }

  await queryWithTimeout(
    "update orders set status = 'cancelled' where id = $1 and customer_id = $2",
    [orderId, session.customerId],
  );
  await queryWithTimeout(
    "insert into audit_log (order_id, customer_id, action, source) values ($1, $2, $3, $4)",
    [orderId, session.customerId, "cancel_order", "chat"],
  );

  return {
    success: true,
    orderId,
    status: "cancelled",
    message: "Your order has been canceled.",
  };
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "listMyOrders",
    description:
      "Get the logged-in customer's most recent orders (up to 5), newest first, each with its id, date, status, a one-line summary, and the amount. Use this whenever the customer asks about their orders without giving a specific order id — which is almost always the case. Takes no input.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "getOrderDetails",
    description:
      "Get full detail for one of the logged-in customer's own orders by id, including its current status and whether it is currently eligible to be canceled.",
    input_schema: {
      type: "object",
      properties: { orderId: { type: "string", description: "The order id." } },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
  {
    name: "getRefundStatus",
    description:
      "Get the state of the refund linked to one of the logged-in customer's own orders by id.",
    input_schema: {
      type: "object",
      properties: { orderId: { type: "string", description: "The order id." } },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
  {
    name: "cancelOrder",
    description:
      "Cancel one of the logged-in customer's own orders by id. Only works while the order has not yet been delivered. Always tell the customer exactly which order this is and that it will be canceled, then wait for their explicit yes before calling this.",
    input_schema: {
      type: "object",
      properties: { orderId: { type: "string", description: "The order id." } },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
];

export const TOOL_HANDLERS: Record<string, (input: unknown) => Promise<ToolResult>> = {
  listMyOrders,
  getOrderDetails,
  getRefundStatus,
  cancelOrder,
};

export const WRITE_TOOL_NAMES = new Set<string>(["cancelOrder"]);
