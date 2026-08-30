import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, getServiceClient } from "@/lib/adminAuth";

export const revalidate = 0;

export interface TopProductStat {
  productName: string;
  totalQty: number;
  totalRevenue: number;
  percentage: number;
}

export interface StatsSummary {
  completedRevenue: number;
  inProgressRevenue: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  totalOrdersCount: number;
}

export interface DailyStatItem {
  date: string;
  sales: number;
  revenue: number;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const serviceClient = getServiceClient();

    // 1. Fetch all orders with order_items for full metrics calculation
    const { data: allOrders } = await serviceClient
      .from("orders")
      .select(`
        id,
        created_at,
        grand_total,
        payment_status,
        fulfillment_status,
        order_items (
          product_name_snapshot,
          size_ml_snapshot,
          qty,
          price_snapshot,
          total_price
        )
      `)
      .order("created_at", { ascending: false });

    // Fallback if orders table is completely empty, check legacy order_intents
    let fallbackLegacyData: Record<string, unknown>[] = [];
    if (!allOrders || allOrders.length === 0) {
      const { data: legacyData } = await serviceClient
        .from("order_intents")
        .select("*")
        .order("created_at", { ascending: false });
      fallbackLegacyData = legacyData || [];
    }

    let completedRevenue = 0;
    let inProgressRevenue = 0;
    let completedOrdersCount = 0;
    let pendingOrdersCount = 0;
    let totalOrdersCount = 0;

    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    let totalQuantitySoldAll = 0;

    // Date setup for 30 days daily stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyData: Record<string, DailyStatItem> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyData[dateStr] = { date: dateStr, sales: 0, revenue: 0 };
    }

    if (allOrders && allOrders.length > 0) {
      totalOrdersCount = allOrders.length;

      allOrders.forEach((order) => {
        const orderRevenue = Number(order.grand_total) || 0;
        const pStatus = (order.payment_status || "").toLowerCase();
        const fStatus = (order.fulfillment_status || "").toLowerCase();

        const isCompleted = fStatus === "completed" || fStatus === "selesai";
        const isPaid = pStatus === "paid" || isCompleted;
        const isCancelled = pStatus === "cancelled" || fStatus === "cancelled";

        if (isCompleted || (isPaid && !isCancelled)) {
          completedRevenue += orderRevenue;
          completedOrdersCount += 1;
        } else if (!isCancelled) {
          inProgressRevenue += orderRevenue;
          if (pStatus === "pending_verification" || pStatus === "pending") {
            pendingOrdersCount += 1;
          }
        }

        // Daily chart mapping (last 30 days, count active/paid orders)
        if (order.created_at && !isCancelled) {
          const dateStr = order.created_at.split("T")[0];
          if (dailyData[dateStr]) {
            dailyData[dateStr].sales += 1;
            dailyData[dateStr].revenue += orderRevenue;
          }
        }

        // Top products calculation from order_items
        if (!isCancelled && Array.isArray(order.order_items)) {
          order.order_items.forEach((item: { product_name_snapshot?: string; qty?: number; total_price?: number; price_snapshot?: number }) => {
            const rawName = item.product_name_snapshot || "Parfum";
            const cleanName = rawName.trim();
            const qty = Number(item.qty) || 1;
            const revenue = Number(item.total_price) || (Number(item.price_snapshot || 0) * qty);

            if (!productSalesMap[cleanName]) {
              productSalesMap[cleanName] = { name: cleanName, qty: 0, revenue: 0 };
            }
            productSalesMap[cleanName].qty += qty;
            productSalesMap[cleanName].revenue += revenue;
            totalQuantitySoldAll += qty;
          });
        }
      });
    } else if (fallbackLegacyData.length > 0) {
      // Process legacy order_intents
      totalOrdersCount = fallbackLegacyData.length;

      fallbackLegacyData.forEach((int) => {
        let meta: Record<string, unknown> = {};
        if (int.items_json) {
          try {
            const parsed = typeof int.items_json === "string" ? JSON.parse(int.items_json) : int.items_json;
            if (typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>;
          } catch {}
        }

        const priceNum = Number(int.total_price || int.price || meta.grandTotal || meta.total_price) || 0;
        const fulfillment = String(int.fulfillment_status || meta.fulfillment_status || meta.fulfillmentStatus || "pending").toLowerCase();
        const payment = String(int.payment_status || meta.payment_status || meta.paymentStatus || "pending_verification").toLowerCase();

        if (fulfillment === "completed" || fulfillment === "selesai" || payment === "paid") {
          completedRevenue += priceNum;
          completedOrdersCount += 1;
        } else if (payment !== "cancelled") {
          inProgressRevenue += priceNum;
          if (payment === "pending_verification" || payment === "pending") {
            pendingOrdersCount += 1;
          }
        }

        const createdAtStr = String(int.created_at || "");
        if (createdAtStr) {
          const dateStr = createdAtStr.split("T")[0];
          if (dailyData[dateStr]) {
            dailyData[dateStr].sales += 1;
            dailyData[dateStr].revenue += priceNum;
          }
        }

        const prodName = String(int.product_name || "Parfum").trim();
        if (!productSalesMap[prodName]) {
          productSalesMap[prodName] = { name: prodName, qty: 0, revenue: 0 };
        }
        productSalesMap[prodName].qty += 1;
        productSalesMap[prodName].revenue += priceNum;
        totalQuantitySoldAll += 1;
      });
    }

    // Format Top 5 Best-Selling Products
    const topProducts: TopProductStat[] = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => ({
        productName: item.name,
        totalQty: item.qty,
        totalRevenue: item.revenue,
        percentage: totalQuantitySoldAll > 0 ? Math.round((item.qty / totalQuantitySoldAll) * 100) : 0,
      }));

    const dailyChartList = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    const summary: StatsSummary = {
      completedRevenue,
      inProgressRevenue,
      completedOrdersCount,
      pendingOrdersCount,
      totalOrdersCount,
    };

    return NextResponse.json({
      dailyStats: dailyChartList,
      summary,
      topProducts,
    });
  } catch (err) {
    console.error("API Route Error in /api/admin/stats:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
