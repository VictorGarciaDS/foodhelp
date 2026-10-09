import type { CreateFood, EquivalentResult, Food, Person, RecipeCandidate } from '@foodhelp/contracts';
import type { ApiClient, GeneratedShoppingList, PrescriptionRecord, ShoppingPlan } from './types';

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
	const method = init.method ?? 'GET';
	let response: Response;
	try {
		response = await fetch(`/api${path}`, {
			...init,
			credentials: 'same-origin',
			headers: {
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
				...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { 'x-foodhelp-request': '1' }),
				...init.headers,
			},
		});
	} catch {
		throw new Error('No se pudo conectar con FoodHelp. Comprueba que el servidor esté activo.');
	}

	if (!response.ok) {
		const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
		throw new Error(payload?.error?.message ?? `La solicitud falló (${response.status}).`);
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}

async function downloadPdf(kind: 'menu' | 'shopping', weekStart: string, peopleIds: string[]): Promise<void> {
	let response: Response;
	try {
		response = await fetch('/api/exports/pdf', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', 'x-foodhelp-request': '1' },
			body: JSON.stringify({ kind, weekStart, peopleIds }),
		});
	} catch {
		throw new Error('No se pudo conectar con FoodHelp. Comprueba que el servidor esté activo.');
	}
	if (!response.ok) {
		const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
		throw new Error(payload?.error?.message ?? `No se pudo generar el PDF (${response.status}).`);
	}

	const url = URL.createObjectURL(await response.blob());
	const link = document.createElement('a');
	link.href = url;
	link.download = `foodhelp-${kind}-${weekStart}.pdf`;
	link.click();
	URL.revokeObjectURL(url);
}

export const api: ApiClient = {
	async health() { return requestJson('/health'); },
	async listFoods() { return (await requestJson<{ items: Food[] }>('/foods')).items; },
	async createFood(input: CreateFood) { return (await requestJson<{ item: Food }>('/foods', { method: 'POST', body: JSON.stringify(input) })).item; },
	async listPeople() { return (await requestJson<{ people: Person[] }>('/people')).people; },
	async createPerson(name) { return (await requestJson<{ person: Person }>('/people', { method: 'POST', body: JSON.stringify({ name }) })).person; },
	async listPrescriptions(personId) {
		return (await requestJson<{ prescriptions: PrescriptionRecord[] }>(`/people/${personId}/prescriptions`)).prescriptions;
	},
	async savePrescription(personId, input) {
		await requestJson(`/people/${personId}/prescription`, { method: 'PUT', body: JSON.stringify(input) });
	},
	async deletePrescription(personId, prescriptionId) {
		await requestJson(`/people/${personId}/prescriptions/${prescriptionId}`, { method: 'DELETE' });
	},
	async calculateEquivalent(foodId: string, quantity: string, unit: string): Promise<EquivalentResult> {
		return requestJson('/equivalents/calculate', { method: 'POST', body: JSON.stringify({ foodId, quantity, unit }) });
	},
	async listRecipes() { return (await requestJson<{ items: Awaited<ReturnType<ApiClient['listRecipes']>> }>('/recipes')).items; },
	async findRecipeMatches(input) {
		return (await requestJson<{ matches: Awaited<ReturnType<ApiClient['findRecipeMatches']>> }>('/recipes/matches', { method: 'POST', body: JSON.stringify(input) })).matches;
	},
	async generateRecipes(input) {
		return (await requestJson<{ recipes: Awaited<ReturnType<ApiClient['generateRecipes']>> }>('/recipes/generate', { method: 'POST', body: JSON.stringify(input) })).recipes;
	},
	async getRecipe(recipeId) { return (await requestJson<{ recipe: Awaited<ReturnType<ApiClient['getRecipe']>> }>(`/recipes/${recipeId}`)).recipe; },
	async createRecipe(input) {
		return (await requestJson<{ recipe: Awaited<ReturnType<ApiClient['getRecipe']>> }>('/recipes', { method: 'POST', body: JSON.stringify(input) })).recipe;
	},
	async updateRecipe(recipeId, input) {
		return (await requestJson<{ recipe: Awaited<ReturnType<ApiClient['getRecipe']>> }>(`/recipes/${recipeId}`, { method: 'PUT', body: JSON.stringify(input) })).recipe;
	},
	async requestSuggestions(weekStart, peopleIds) {
		return (await requestJson<{ suggestions: RecipeCandidate[] }>('/recipes/suggestions', {
			method: 'POST', body: JSON.stringify({ weekStart, peopleIds }),
		})).suggestions;
	},
	async getWeek(weekStart) { return (await requestJson<{ days: Awaited<ReturnType<ApiClient['getWeek']>> }>(`/menus/${weekStart}`)).days; },
	async generateMenu(weekStart, peopleIds) {
		await requestJson('/menus/generate', { method: 'POST', body: JSON.stringify({ weekStart, peopleIds }) });
	},
	async getShopping(weekStart, peopleIds) {
		const query = new URLSearchParams();
		peopleIds.forEach((id) => query.append('peopleIds', id));
		return (await requestJson<{ items: Awaited<ReturnType<ApiClient['getShopping']>> }>(`/shopping-list/${weekStart}?${query}`)).items;
	},
	async calculateShopping(input: ShoppingPlan): Promise<GeneratedShoppingList> {
		return requestJson('/shopping-list/calculate', { method: 'POST', body: JSON.stringify(input) });
	},
	async exportPdf(kind, weekStart, peopleIds) { await downloadPdf(kind, weekStart, peopleIds); },
};

export type { ApiClient } from './types';