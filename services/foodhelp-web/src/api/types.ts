import type {
  CreateFood, EquivalentResult, Food, FoodGroup, RecipeCandidate, Person, RecipeDiscovery, RecipeEdit,
} from '@foodhelp/contracts';

export type PageState = 'data' | 'loading' | 'empty' | 'error';
export type WeekDay = { day: string; menuCount: string; status: string };
export type RecipeSummary = { id: string; name: string; verifiedAt: string | null; personId: string | null; personName: string | null; mealTime: string | null; reviewNotes: string[] };
export type RecipeMatch = RecipeSummary & { matchCount: number; matchedFoodIds: string[] };
export type RecipeIngredient = RecipeCandidate['ingredients'][number];
export type RecipeDetail = RecipeSummary & { instructions: string[]; ingredients: RecipeIngredient[]; sourceText: string | null };
export type ShoppingParticipant = { personId: string; days?: number; meals: { mealTime: 'Desayuno' | 'Almuerzo' | 'Comida' | 'Cena'; recipeIds: string[] }[] };
export type ShoppingPlan = { days: number; participants: ShoppingParticipant[] };
export type GeneratedShoppingList = { days: number; participantCount: number; participants: { personId: string; days: number }[]; usage: { personId: string; mealTime: string; recipeId: string; day: number }[]; items: ShoppingItem[] };
export type ShoppingItem = { foodId: string; name: string; unit: string; quantity: string };
export type PrescriptionInput = {
  month: string;
  reviewed: true;
  indicatedOn?: string | null;
  meals: { mealTime: string; group: FoodGroup; equivalents: string; requirementKind?: 'exact' | 'free_guidance'; preferredFoodId?: string | null; notes?: string | null }[];
};
export type PrescriptionRecord = Omit<PrescriptionInput, 'reviewed'> & { id: string; personId: string; reviewedAt: string | null };
export interface ApiClient {
  health(): Promise<{ status: string; services: Record<string, string> }>;
  listFoods(): Promise<Food[]>;
  createFood(input: CreateFood): Promise<Food>;
  listPeople(): Promise<Person[]>;
  createPerson(name: string): Promise<Person>;
  listPrescriptions(personId: string): Promise<PrescriptionRecord[]>;
  savePrescription(personId: string, input: PrescriptionInput): Promise<void>;
  deletePrescription(personId: string, prescriptionId: string): Promise<void>;
  calculateEquivalent(foodId: string, quantity: string, unit: string): Promise<EquivalentResult>;
  listRecipes(): Promise<RecipeSummary[]>;
  findRecipeMatches(input: RecipeDiscovery): Promise<RecipeMatch[]>;
  generateRecipes(input: RecipeDiscovery): Promise<RecipeDetail[]>;
  getRecipe(recipeId: string): Promise<RecipeDetail>;
  createRecipe(input: RecipeEdit): Promise<RecipeDetail>;
  updateRecipe(recipeId: string, input: RecipeEdit): Promise<RecipeDetail>;
  requestSuggestions(weekStart: string, peopleIds: string[]): Promise<RecipeCandidate[]>;
  getWeek(weekStart: string): Promise<WeekDay[]>;
  generateMenu(weekStart: string, peopleIds: string[]): Promise<void>;
  getShopping(weekStart: string, peopleIds: string[]): Promise<ShoppingItem[]>;
  calculateShopping(input: ShoppingPlan): Promise<GeneratedShoppingList>;
  exportPdf(kind: 'menu' | 'shopping', weekStart: string, peopleIds: string[]): Promise<void>;
}