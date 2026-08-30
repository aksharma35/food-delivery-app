import { config } from "dotenv";
import path from "path";
import { Pool } from "pg";
import { resolveConnectionString } from "../lib/db";

// Standalone script (not run through Next.js), so environment variables
// aren't loaded automatically — pull them from the same files Next.js would.
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

type SeedCustomer = { id: number; name: string; email: string };
type SeedOrder = {
  id: string;
  customerId: number;
  status: string;
  items: string;
  totalAmount: number;
};

// Order id '9999' is reserved for the on-camera "order not found" demo and
// must never exist in this table — see the check after seeding below.
const CUSTOMERS: SeedCustomer[] = [
  { id: 1, name: "Priya Nair", email: "priya.nair@example.com" },
  { id: 2, name: "Marcus Lee", email: "marcus.lee@example.com" },
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

    await pool.query(`
      create table if not exists orders (
        id text primary key,
        customer_id integer references customers(id),
        status text not null,
        items text not null,
        total_amount numeric not null
      );
    `);

    for (const customer of CUSTOMERS) {
      await pool.query(
        `insert into customers (id, name, email) values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name, email = excluded.email`,
        [customer.id, customer.name, customer.email],
      );
    }

    // Keep the id sequence ahead of our explicit ids so any future insert
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

    const reserved = await pool.query("select id from orders where id = '9999'");
    if (reserved.rows.length > 0) {
      throw new Error("Order 9999 exists in the database — it must be removed for the demo.");
    }

    console.log(`Seeded ${CUSTOMERS.length} customers and ${ORDERS.length} orders.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
