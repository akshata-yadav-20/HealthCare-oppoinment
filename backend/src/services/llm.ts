import { env } from '../config/env';
import { logger } from '../config/logger';
export type PreVisitOutput = { urgencyLevel: 'Low'|'Medium'|'High'; chiefComplaint: string; suggestedQuestions: string[] };
export type PostVisitOutput = { summary: string; medicationSchedule: any[]; followUpInstructions: string };
async function callWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timeout: any;
  const p = new Promise<never>((_, rej) => { timeout = setTimeout(() => rej(new Error('LLM timeout')), ms); });
  try { const res = await Promise.race([fn(), p]); clearTimeout(timeout); return res as T; } catch (e) { clearTimeout(timeout); throw e; }
}
async function callOpenAI(prompt: string, system: string): Promise<string> {
  const res = await fetch(env.LLM_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.LLM_API_KEY },
    body: JSON.stringify({ model: env.LLM_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.2 }),
  });
  if (!res.ok) throw new Error('LLM API ' + res.status + ': ' + await res.text());
  const json: any = await res.json();
  return json.choices?.[0]?.message?.content || '';
}
function fallbackPreVisit(symptoms: string): PreVisitOutput {
  const low = symptoms.toLowerCase();
  let urgency: 'Low'|'Medium'|'High' = 'Low';
  if (low.includes('chest pain') || low.includes('difficulty breathing') || low.includes('severe')) urgency = 'High';
  else if (low.includes('fever') || low.includes('pain') || low.includes('vomit')) urgency = 'Medium';
  return { urgencyLevel: urgency, chiefComplaint: symptoms.slice(0,120), suggestedQuestions: ['When did symptoms start?','Any associated symptoms?','Current medications?'] };
}
function fallbackPostVisit(notes: string): PostVisitOutput {
  return { summary: 'Summary unavailable - please review raw notes below:\n' + notes.slice(0,500), medicationSchedule: [], followUpInstructions: 'Follow doctor instructions and attend follow-up as advised.' };
}
export async function generatePreVisit(symptoms: string): Promise<{ data: PreVisitOutput | null; raw: string; status: 'SUCCESS'|'FAILED' }> {
  const prompt = 'Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Return ONLY valid JSON with keys urgencyLevel, chiefComplaint, suggestedQuestions (array of 3). Symptoms: ' + symptoms;
  const system = 'You are a medical triage assistant. Return only valid JSON.';
  if (!env.LLM_API_KEY || env.LLM_PROVIDER === 'stub') {
    logger.info('LLM stub mode - pre-visit fallback');
    const fb = fallbackPreVisit(symptoms);
    return { data: fb, raw: JSON.stringify(fb), status: 'SUCCESS' };
  }
  try {
    const raw = await callWithTimeout(() => callOpenAI(prompt, system), env.LLM_TIMEOUT_MS);
    logger.info({ raw: raw.slice(0,200) }, 'LLM pre-visit raw');
    try {
      const parsed = JSON.parse((raw.match(/\{[\s\S]*\}/)?.[0] || raw));
      if (!parsed.urgencyLevel || !parsed.chiefComplaint || !Array.isArray(parsed.suggestedQuestions)) throw new Error('Invalid shape');
      return { data: parsed, raw, status: 'SUCCESS' };
    } catch (e) {
      logger.warn('LLM JSON parse failed, retrying');
      const retryPrompt = prompt + '\nIMPORTANT: Return ONLY valid JSON, no markdown, no extra text.';
      const raw2 = await callWithTimeout(() => callOpenAI(retryPrompt, system), env.LLM_TIMEOUT_MS);
      const parsed2 = JSON.parse((raw2.match(/\{[\s\S]*\}/)?.[0] || raw2));
      return { data: parsed2, raw: raw2, status: 'SUCCESS' };
    }
  } catch (e: any) {
    logger.error({ err: e.message }, 'LLM pre-visit failed, using fallback');
    const fb = fallbackPreVisit(symptoms);
    return { data: fb, raw: JSON.stringify(fb) + ' [fallback due to error: '+e.message+']', status: 'FAILED' };
  }
}
export async function generatePostVisit(notes: string, prescription: any): Promise<{ data: PostVisitOutput | null; raw: string; status: 'SUCCESS'|'FAILED' }> {
  const prompt = 'Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Return JSON with keys summary (string), medicationSchedule (array of {drug, dose, timing, duration}), followUpInstructions (string). Notes: ' + notes + '\nPrescription: ' + JSON.stringify(prescription);
  const system = 'You are a clinical summarizer. Return only valid JSON, patient-friendly language.';
  if (!env.LLM_API_KEY || env.LLM_PROVIDER === 'stub') {
    logger.info('LLM stub mode - post-visit fallback');
    const fb = fallbackPostVisit(notes);
    return { data: fb, raw: JSON.stringify(fb), status: 'SUCCESS' };
  }
  try {
    const raw = await callWithTimeout(() => callOpenAI(prompt, system), env.LLM_TIMEOUT_MS);
    logger.info({ raw: raw.slice(0,200) }, 'LLM post-visit raw');
    try {
      const parsed = JSON.parse((raw.match(/\{[\s\S]*\}/)?.[0] || raw));
      return { data: parsed, raw, status: 'SUCCESS' };
    } catch {
      const retryPrompt = prompt + '\nReturn ONLY valid JSON.';
      const raw2 = await callWithTimeout(() => callOpenAI(retryPrompt, system), env.LLM_TIMEOUT_MS);
      const parsed2 = JSON.parse((raw2.match(/\{[\s\S]*\}/)?.[0] || raw2));
      return { data: parsed2, raw: raw2, status: 'SUCCESS' };
    }
  } catch (e: any) {
    logger.error({ err: e.message }, 'LLM post-visit failed');
    const fb = fallbackPostVisit(notes);
    return { data: fb, raw: JSON.stringify(fb), status: 'FAILED' };
  }
}
