import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import LogoutButton from "@/app/components/LogoutButton";

export const metadata: Metadata = {
  title: "Your orders — Foodly",
};

type OrderRow = { id: string; status: string; items: string; total_amount: string };
type RefundRow = { id: number; order_id: string; status: string; reason: string | null; amount: string };

const RESTAURANTS = [
  { emoji: "🍕", name: "Bella Napoli", cuisine: "Italian", rating: "4.8" },
  { emoji: "🍛", name: "Spice Route", cuisine: "Indian", rating: "4.6" },
  { emoji: "🥡", name: "Dragon Wok", cuisine: "Chinese", rating: "4.5" },
  { emoji: "🌮", name: "Taco Fiesta", cuisine: "Mexican", rating: "4.7" },
];

const STATUS_STYLES: Record<string, string> = {
  preparing: "bg-amber-100 text-amber-800",
  out_for_delivery: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  requested: "bg-amber-100 text-amber-800",
  processed: "bg-green-100 text-green-800",
};

function StatusBadge({ status }: { status: string }) {
  const className = STATUS_STYLES[status] ?? "bg-foreground/10 text-foreground/70";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${className}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [orders, refunds] = await Promise.all([
    query<OrderRow>(
      "select id, status, items, total_amount from orders where customer_id = $1 order by id desc",
      [session.customerId],
    ),
    query<RefundRow>(
      "select id, order_id, status, reason, amount from refunds where customer_id = $1 order by id desc",
      [session.customerId],
    ),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/5 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-lg"
              aria-hidden
            >
              🍔
            </span>
            Foodly
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Hey, {session.name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-foreground/60">{session.phone}</p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Your orders</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/60">No orders yet — hungry?</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-background p-5 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Order #{order.id}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-foreground/70">{order.items}</p>
                  <p className="text-sm font-medium text-foreground">${order.total_amount}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {refunds.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Refund updates</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-background p-5 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Order #{refund.order_id}</span>
                    <StatusBadge status={refund.status} />
                  </div>
                  {refund.reason && <p className="text-sm text-foreground/70">{refund.reason}</p>}
                  <p className="text-sm font-medium text-foreground">${refund.amount}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Popular restaurants near you</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RESTAURANTS.map((restaurant) => (
              <div
                key={restaurant.name}
                className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-cream/60 p-6 text-center transition-shadow hover:shadow-md"
              >
                <span className="text-3xl" aria-hidden>
                  {restaurant.emoji}
                </span>
                <span className="font-semibold">{restaurant.name}</span>
                <span className="text-xs text-foreground/60">{restaurant.cuisine}</span>
                <span className="text-xs font-medium text-brand-dark">★ {restaurant.rating}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
