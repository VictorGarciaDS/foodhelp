import { z } from 'zod';
import { recipeCandidateSchema, type RecipeCandidate } from '@foodhelp/contracts';
import { config } from '../config';
import { ApiError } from '../http-error';

const suggestionsSchema = z.array(recipeCandidateSchema).length(3);

function extractSuggestions(payload: unknown): RecipeCandidate[] {
  if (typeof payload === 'string') {
    const normalized = payload.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return extractSuggestions(JSON.parse(normalized));
  }
  if (Array.isArray(payload)) return suggestionsSchema.parse(payload);
  if (!payload || typeof payload !== 'object') throw new Error('Respuesta sin objeto JSON.');
  const object = payload as Record<string, unknown>;
  if (object.suggestions !== undefined) return suggestionsSchema.parse(object.suggestions);
  if (Array.isArray(object.choices) && object.choices.length) {
    const choice = object.choices[0] as Record<string, unknown>;
    const message = choice.message as Record<string, unknown> | undefined;
    const content = message?.content ?? choice.text;
    if (content !== undefined) return extractSuggestions(content);
  }
  if (object.output_text !== undefined) return extractSuggestions(object.output_text);
  throw new Error('La respuesta no contiene propuestas JSON.');
}

export async function requestRecipeProposals(context: string): Promise<RecipeCandidate[]> {
  if (!config.aiEnabled) {
    throw new ApiError(503, 'ENHANCEMENT_UNAVAILABLE', 'Las propuestas externas estan desactivadas o su contrato no esta confirmado.');
  }
  let status: number | null = null;
  let reachedResponse = false;
  try {
    const systemPrompt = [
      'Eres un asistente culinario que propone platillos familiares lógicos y apetitosos.',
      'Usa únicamente alimentos, unidades, perfil, tiempo de comida y equivalencias proporcionados.',
      'Incluye todos los ingredientes principales seleccionados.',
      'Suma exactamente las equivalencias prescritas por grupo; puedes mezclar porciones completas, submúltiplos y múltiplos.',
      'No conviertas unidades ni uses porciones base inventadas. Los alimentos libres no suman equivalencias.',
      'No combines sabores incompatibles (por ejemplo, chilaquiles con mermelada).',
      'Responde solo con JSON: {"suggestions":[{"name":"...","instructions":["..."],"ingredients":[{"foodId":"uuid","quantity":"1/2","unit":"unidad exacta del catálogo","group":"grupo del catálogo","isFreeConsumption":false}]}]}.',
      'Incluye exactamente tres propuestas.',
    ].join(' ');
    const response = await fetch(config.AI_API_BASE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-student-key': config.AI_STUDENT_KEY },
      body: JSON.stringify({
        model: config.AI_MODEL,
        prompt: context,
        system_prompt: systemPrompt,
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 1,
        max_tokens: 0,
      }),
      signal: AbortSignal.timeout(60000),
    });
    reachedResponse = true;
    status = response.status;
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
    const text = await response.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = text; }
    return extractSuggestions(payload);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : '';
    const message = status && status >= 400
      ? `El proveedor de recetas respondió HTTP ${status}. Las recetas guardadas permanecen disponibles.`
      : errorName === 'TimeoutError' || errorName === 'AbortError'
        ? 'La generación excedió 60 segundos. No se guardaron propuestas.'
        : reachedResponse
          ? 'El proveedor respondió, pero su salida no contiene tres recetas con JSON válido. No se guardaron propuestas.'
          : 'No se pudo conectar al proveedor de recetas. No se guardaron propuestas.';
    throw new ApiError(503, 'ENHANCEMENT_UNAVAILABLE', message);
  }
}