
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerName, customerEmail, items } = body;

    if (
      typeof customerName !== "string" ||
      customerName.trim().length < 2 ||
      customerName.trim().length > 100
    ) {
      return NextResponse.json(
        { error: "Enter a valid customer name." },
        { status: 400 }
      );
    }

    if (
      typeof customerEmail !== "string" ||
      customerEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    ) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50
    ) {
      return NextResponse.json(
        { error: "Cart is empty or invalid." },
        { status: 400 }
      );
    }

    const productIds: string[] = [];

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10
      ) {
        return NextResponse.json(
          { error: "Invalid cart item." },
          { status: 400 }
        );
      }

      productIds.push(item.productId);
    }

    if (new Set(productIds).size !== productIds.length) {
      return NextResponse.json(
        { error: "Duplicate products in cart." },
        { status: 400 }
      );
    }

    // Get trusted product prices and stock from the database.
    const { data: products, error: productError } =
      await supabaseServer
        .from("products")
        .select("id, name, price, stock")
        .in("id", productIds);

    if (productError) {
      console.error("Product lookup failed:", productError.message);

      return NextResponse.json(
        { error: "Could not verify products." },
        { status: 500 }
      );
    }

    if (!products || products.length !== items.length) {
      return NextResponse.json(
        { error: "One or more products were not found." },
        { status: 400 }
      );
    }

    const orderItems = [];

    for (const item of items) {
      const product = products.find(
        (p) => p.id === item.productId
      );

      if (!product || item.quantity > product.stock) {
        return NextResponse.json(
          { error: "Insufficient stock for a product." },
          { status: 400 }
        );
      }

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity: item.quantity,
        line_total: product.price * item.quantity,
      });
    }

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.line_total,
      0
    );

    // Create a pending order. Payment is not confirmed here.
    const { data: order, error: orderError } =
      await supabaseServer
        .from("orders")
        .insert({
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          total_amount: totalAmount,
          payment_status: "pending",
          order_status: "pending",
        })
        .select("id, total_amount, payment_status")
        .single();

    if (orderError || !order) {
      console.error("Order creation failed:", orderError?.message);

      return NextResponse.json(
        { error: "Could not create order." },
        { status: 500 }
      );
    }

    const rows = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabaseServer
      .from("order_items")
      .insert(rows);

    if (itemsError) {
      console.error("Order items creation failed:", itemsError.message);

      // Avoid leaving an incomplete order.
      await supabaseServer
        .from("orders")
        .delete()
        .eq("id", order.id);

      return NextResponse.json(
        { error: "Could not save order items." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Order created successfully.",
        order,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
