
import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/prisma";
import { getCurrentUser } from "../../../../lib/current-user";

const defaultCategories = [
  // Income categories
  { name: "Salary", type: "INCOME" as const },
  { name: "Freelancing", type: "INCOME" as const },
  { name: "Business", type: "INCOME" as const },
  { name: "Investments", type: "INCOME" as const },
  { name: "Gifts", type: "INCOME" as const },
  { name: "Other Income", type: "INCOME" as const },

  // Expense categories
  { name: "Food & Drinks", type: "EXPENSE" as const },
  { name: "Transport", type: "EXPENSE" as const },
  { name: "Shopping", type: "EXPENSE" as const },
  { name: "Bills & Utilities", type: "EXPENSE" as const },
  { name: "Rent", type: "EXPENSE" as const },
  { name: "Health", type: "EXPENSE" as const },
  { name: "Education", type: "EXPENSE" as const },
  { name: "Entertainment", type: "EXPENSE" as const },
  { name: "Travel", type: "EXPENSE" as const },
  { name: "Other Expenses", type: "EXPENSE" as const },
];

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await prisma.category.createMany({
      data: defaultCategories.map((category) => ({
        ...category,
        userId: user.id,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: "Default categories created successfully",
      created: result.count,
    });
  } catch (error) {
    console.error("Default category error:", error);

    return NextResponse.json(
      { error: "Failed to create default categories" },
      { status: 500 }
    );
  }
}
