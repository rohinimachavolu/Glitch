/**
 * Glitch — Local nutrition database
 * Works WITHOUT any API key so macros always populate. Values per typical serving.
 * Source anchors: USDA FoodData Central typical values (generalized).
 * The LLM lookup refines these when available; this is the floor.
 */
export interface FoodFacts {
  name: string;
  calories: number; protein: number; carbs: number; fats: number; fiber: number; omega3: number;
  iron?: number; calcium?: number;
  per: string;
}

const FOODS: Record<string, FoodFacts> = {
  rice:     { name: "Rice (cooked)", calories: 130, protein: 2.7, carbs: 28, fats: 0.3, fiber: 0.4, omega3: 0, per: "100g" },
  dal:      { name: "Dal / lentils", calories: 116, protein: 9, carbs: 20, fats: 0.4, fiber: 8, omega3: 0.1, iron: 3.3, per: "100g" },
  lentil:   { name: "Lentils", calories: 116, protein: 9, carbs: 20, fats: 0.4, fiber: 8, omega3: 0.1, iron: 3.3, per: "100g" },
  paneer:   { name: "Paneer", calories: 265, protein: 18, carbs: 3, fats: 20, fiber: 0, omega3: 0, calcium: 480, per: "100g" },
  chicken:  { name: "Chicken breast", calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0, omega3: 0.1, per: "100g" },
  egg:      { name: "Egg", calories: 78, protein: 6.3, carbs: 0.6, fats: 5.3, fiber: 0, omega3: 0.1, per: "1 large" },
  eggs:     { name: "Eggs", calories: 156, protein: 12.6, carbs: 1.2, fats: 10.6, fiber: 0, omega3: 0.2, per: "2 large" },
  tofu:     { name: "Tofu", calories: 76, protein: 8, carbs: 1.9, fats: 4.8, fiber: 0.3, omega3: 0.4, iron: 1.6, calcium: 350, per: "100g" },
  oats:     { name: "Oats (cooked)", calories: 71, protein: 2.5, carbs: 12, fats: 1.5, fiber: 1.7, omega3: 0.1, per: "100g" },
  banana:   { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fats: 0.4, fiber: 3.1, omega3: 0, per: "1 medium" },
  apple:    { name: "Apple", calories: 95, protein: 0.5, carbs: 25, fats: 0.3, fiber: 4.4, omega3: 0, per: "1 medium" },
  milk:     { name: "Milk", calories: 103, protein: 8, carbs: 12, fats: 2.4, fiber: 0, omega3: 0.1, calcium: 300, per: "1 cup" },
  yogurt:   { name: "Yogurt", calories: 100, protein: 10, carbs: 7, fats: 2.5, fiber: 0, omega3: 0, calcium: 180, per: "150g" },
  curd:     { name: "Curd", calories: 98, protein: 11, carbs: 7, fats: 2.5, fiber: 0, omega3: 0, calcium: 180, per: "150g" },
  salmon:   { name: "Salmon", calories: 208, protein: 20, carbs: 0, fats: 13, fiber: 0, omega3: 2.3, per: "100g" },
  spinach:  { name: "Spinach", calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, fiber: 2.2, omega3: 0.1, iron: 2.7, calcium: 99, per: "100g" },
  bread:    { name: "Bread", calories: 79, protein: 3.1, carbs: 14, fats: 1, fiber: 1.1, omega3: 0, per: "1 slice" },
  roti:     { name: "Roti / chapati", calories: 120, protein: 3, carbs: 18, fats: 3.7, fiber: 2.7, omega3: 0, iron: 1.1, per: "1 piece" },
  chapati:  { name: "Chapati", calories: 120, protein: 3, carbs: 18, fats: 3.7, fiber: 2.7, omega3: 0, iron: 1.1, per: "1 piece" },
  almond:   { name: "Almonds", calories: 164, protein: 6, carbs: 6, fats: 14, fiber: 3.5, omega3: 0, calcium: 76, per: "28g" },
  peanut:   { name: "Peanut butter", calories: 188, protein: 8, carbs: 6, fats: 16, fiber: 2, omega3: 0, per: "2 tbsp" },
  chickpea: { name: "Chickpeas", calories: 164, protein: 9, carbs: 27, fats: 2.6, fiber: 8, omega3: 0.1, iron: 2.9, per: "100g" },
  chana:    { name: "Chana (chickpeas)", calories: 164, protein: 9, carbs: 27, fats: 2.6, fiber: 8, omega3: 0.1, iron: 2.9, per: "100g" },
  potato:   { name: "Potato", calories: 87, protein: 1.9, carbs: 20, fats: 0.1, fiber: 1.8, omega3: 0, per: "100g" },
  salad:    { name: "Mixed salad", calories: 50, protein: 2, carbs: 8, fats: 1.5, fiber: 3, omega3: 0.1, per: "1 bowl" },
  coffee:   { name: "Coffee (black)", calories: 2, protein: 0.3, carbs: 0, fats: 0, fiber: 0, omega3: 0, per: "1 cup" },
  flax:     { name: "Flax seeds", calories: 55, protein: 1.9, carbs: 3, fats: 4.3, fiber: 2.8, omega3: 2.4, per: "1 tbsp" },
};

/** Parse "100g rice & dal with 50g paneer" into a summed estimate. */
export function lookupLocal(text: string): FoodFacts {
  const lower = text.toLowerCase();
  const found: { facts: FoodFacts; qty: number }[] = [];

  for (const [key, facts] of Object.entries(FOODS)) {
    if (!lower.includes(key)) continue;
    const gramMatch = lower.match(new RegExp(`(\\d+)\\s*g[^a-z]*${key}|${key}[^0-9]*(\\d+)\\s*g`));
    const grams = gramMatch ? Number(gramMatch[1] ?? gramMatch[2]) : null;
    const qty = grams && facts.per.includes("100g") ? grams / 100 : 1;
    found.push({ facts, qty });
  }

  if (found.length === 0) {
    return { name: text, calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, omega3: 0, per: "unknown" };
  }

  const sum = found.reduce((a, { facts, qty }) => ({
    name: a.name, per: "estimate",
    calories: a.calories + facts.calories * qty,
    protein: a.protein + facts.protein * qty,
    carbs: a.carbs + facts.carbs * qty,
    fats: a.fats + facts.fats * qty,
    fiber: a.fiber + facts.fiber * qty,
    omega3: a.omega3 + facts.omega3 * qty,
    iron: (a.iron ?? 0) + (facts.iron ?? 0) * qty,
    calcium: (a.calcium ?? 0) + (facts.calcium ?? 0) * qty,
  }), { name: found.map((f) => f.facts.name).join(" + "), calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, omega3: 0, iron: 0, calcium: 0, per: "estimate" } as FoodFacts);

  (["calories", "protein", "carbs", "fats", "fiber", "omega3", "iron", "calcium"] as const).forEach((k) => {
    if (typeof sum[k] === "number") (sum[k] as number) = Math.round((sum[k] as number) * 10) / 10;
  });
  return sum;
}
