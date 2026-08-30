import { config } from "dotenv";
import path from "path";
import { Pool } from "pg";
import { resolveConnectionString } from "../lib/db";

// Standalone script (not run through Next.js), so environment variables
// aren't loaded automatically — pull them from the same files Next.js would.
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

type SeedCustomer = { id: number; name: string; email: string; phone: string };
type SeedOrder = {
  id: string;
  customerId: number;
  status: string;
  items: string;
  totalAmount: number;
};
type SeedRefund = {
  id: number;
  orderId: string;
  customerId: number;
  status: string;
  reason: string;
  amount: number;
};

// Order id '9999' is reserved for the on-camera "order not found" demo and
// must never exist in this table — see the check after seeding below.
// Phone numbers double as the demo login: any of these + the fixed
// FOODLY_DEMO_OTP code logs in as that customer.
const CUSTOMERS: SeedCustomer[] = [
  { id: 1, name: "Priya Nair", email: "priya.nair@example.com", phone: "+919876543210" },
  { id: 2, name: "Marcus Lee", email: "marcus.lee@example.com", phone: "+14155550134" },
];

const ORDERS: SeedOrder[] = [
  {
    id: "4521",
    customerId: 1,
    status: "delivered",
    items: "2x Paneer Wrap, 1x Cold Coffee",
    totalAmount: 18.5,
  },
  {
    id: "4522",
    customerId: 1,
    status: "preparing",
    items: "1x Margherita Pizza, 1x Garlic Bread",
    totalAmount: 22.0,
  },
  {
    id: "4523",
    customerId: 2,
    status: "out_for_delivery",
    items: "1x Chicken Biryani, 2x Mango Lassi",
    totalAmount: 27.75,
  },
  {
    id: "4524",
    customerId: 2,
    status: "delivered",
    items: "3x Veggie Tacos",
    totalAmount: 15.25,
  },
  {
    id: "4525",
    customerId: 2,
    status: "preparing",
    items: "1x Double Cheeseburger, 1x Fries, 1x Cola",
    totalAmount: 16.4,
  },
];

const REFUNDS: SeedRefund[] = [
  {
    id: 1,
    orderId: "4521",
    customerId: 1,
    status: "requested",
    reason: "Order arrived cold",
    amount: 18.5,
  },
  {
    id: 2,
    orderId: "4524",
    customerId: 2,
    status: "processed",
    reason: "Missing item from order",
    amount: 5.0,
  },
];

async function main() {
  const pool = new Pool({ connectionString: resolveConnectionString() });

  try {
    await pool.query(`
      create table if not exists customers (
        id serial primary key,
        name text not null,
        email text not null
      );
    `);
    await pool.query(`alter table customers add column if not exists phone text;`);
    // Partial index: allows multiple NULLs (pre-migration rows) while still
    // enforcing uniqueness once a phone is set, since phone doubles as the
    // demo login lookup key.
    await pool.query(
      `create unique index if not exists customers_phone_key on customers (phone) where phone is not null;`,
    );

    await pool.query(`
      create table if not exists orders (
        id text primary key,
        customer_id integer references customers(id),
        status text not null,
        items text not null,
        total_amount numeric not null
      );
    `);

    await pool.query(`
      create table if not exists refunds (
        id serial primary key,
        order_id text not null references orders(id),
        customer_id integer references customers(id),
        status text not null,
        reason text,
        amount numeric not null,
        created_at timestamptz not null default now()
      );
    `);

    for (const customer of CUSTOMERS) {
      await pool.query(
        `insert into customers (id, name, email, phone) values ($1, $2, $3, $4)
         on conflict (id) do update set name = excluded.name, email = excluded.email, phone = excluded.phone`,
        [customer.id, customer.name, customer.email, customer.phone],
      );
    }

    // Keep the id sequences ahead of our explicit ids so any future insert
    // that relies on the default (outside this script) doesn't collide.
    await pool.query(
      `select setval(pg_get_serial_sequence('customers', 'id'), (select max(id) from customers))`,
    );

    for (const order of ORDERS) {
      if (order.id === "9999") {
        throw new Error("Refusing to seed order id 9999 — it is reserved for the 'not found' demo.");
      }
      await pool.query(
        `insert into orders (id, customer_id, status, items, total_amount) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set
           customer_id = excluded.customer_id,
           status = excluded.status,
           items = excluded.items,
           total_amount = excluded.total_amount`,
        [order.id, order.customerId, order.status, order.items, order.totalAmount],
      );
    }

    for (const refund of REFUNDS) {
      await pool.query(
        `insert into refunds (id, order_id, customer_id, status, reason, amount) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set
           order_id = excluded.order_id,
           customer_id = excluded.customer_id,
           status = excluded.status,
           reason = excluded.reason,
           amount = excluded.amount`,
        [refund.id, refund.orderId, refund.customerId, refund.status, refund.reason, refund.amount],
      );
    }

    await pool.query(
      `select setval(pg_get_serial_sequence('refunds', 'id'), (select max(id) from refunds))`,
    );

    const reserved = await pool.query("select id from orders where id = '9999'");
    if (reserved.rows.length > 0) {
      throw new Error("Order 9999 exists in the database — it must be removed for the demo.");
    }

    console.log(
      `Seeded ${CUSTOMERS.length} customers, ${ORDERS.length} orders, and ${REFUNDS.length} refunds.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
