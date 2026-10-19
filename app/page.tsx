
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
};

type CartItem = Product & {
  quantity: number;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function getProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          setError(error.message);
        } else {
          setProducts(data ?? []);
        }
      } catch {
        setError("Could not connect to Supabase.");
      } finally {
        setLoading(false);
      }
    }

    getProducts();
  }, []);

  function addToCart(product: Product) {
    setError("");
    setMessage("");

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === product.id
      );

      if (existing) {
        if (existing.quantity >= product.stock) {
          setError("Maximum available stock reached.");
          return current;
        }

        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      if (product.stock < 1) {
        setError("This product is out of stock.");
        return current;
      }

      return [...current, { ...product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((current) =>
      current.filter((item) => item.id !== productId)
    );
    setError("");
    setMessage("");
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setCheckingOut(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Checkout failed.");
        return;
      }

      setMessage(
        `Order created! Order ID: ${result.order.id}. Payment is still pending.`
      );
      setCart([]);
      setCustomerName("");
      setCustomerEmail("");
    } catch {
      setError("Could not reach the checkout API.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <h1 className="mb-2 text-3xl font-bold">MMQR Store</h1>
      <p className="mb-8 text-gray-600">Our Products</p>

      {loading && <p>Loading products...</p>}

      {error && (
        <p className="mb-4 rounded-lg bg-red-100 p-3 text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="mb-4 break-words rounded-lg bg-green-100 p-3 text-green-800">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold">{product.name}</h2>

            <p className="mt-2 text-gray-600">
              {product.description}
            </p>

            <p className="mt-4 text-2xl font-bold">
              {product.price.toLocaleString()} Ks
            </p>

            <p className="mt-2 text-sm text-gray-500">
              Stock: {product.stock}
            </p>

            <button
              onClick={() => addToCart(product)}
              disabled={product.stock <= 0}
              className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-white disabled:bg-gray-400"
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">
          Your Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
        </h2>

        {cart.length === 0 ? (
          <p className="mt-4 text-gray-500">Your cart is empty.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 border-b pb-4"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">
                    {item.price.toLocaleString()} Ks × {item.quantity}
                  </p>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}

            <p className="text-xl font-bold">
              Total: {total.toLocaleString()} Ks
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">Checkout</h2>

        <form onSubmit={checkout} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="customerName"
              className="mb-1 block font-medium"
            >
              Customer Name
            </label>
            <input
              id="customerName"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              minLength={2}
              maxLength={100}
              className="w-full rounded-lg border p-3"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label
              htmlFor="customerEmail"
              className="mb-1 block font-medium"
            >
              Email
            </label>
            <input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              required
              maxLength={254}
              className="w-full rounded-lg border p-3"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={checkingOut || cart.length === 0}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {checkingOut ? "Creating Order..." : "Create Test Order"}
          </button>
        </form>
      </section>
    </main>
  );
}
