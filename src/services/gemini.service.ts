import { Injectable } from '@angular/core';
import { Employee } from '../models/user.model';
import { Coupon } from '../models/coupon.model';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  // The GoogleGenAI client is created lazily inside `generateInsights` so
  // the service can be instantiated in browser environments where `process`
  // and server-only libs are not available.
  constructor() {
    // no-op constructor to avoid accessing server-only globals at init
  }

  async generateInsights(question: string, employees: Employee[], coupons: Coupon[]): Promise<string> {
    
    // 1. Prepare and simplify the data to be sent to the AI.
    // This reduces token count and focuses the AI on relevant information.
    const simplifiedEmployees = employees.map(emp => ({
      id: emp.id,
      role: emp.role,
      department: emp.department || 'N/A',
      contractor: emp.contractor || 'N/A'
    }));

    const simplifiedCoupons = coupons.map(c => ({
      employeeId: c.employeeId,
      couponType: c.couponType,
      status: c.status,
      dateIssued: c.dateIssued.split('T')[0], // Keep only the date part
      redeemDate: c.redeemDate ? c.redeemDate.split('T')[0] : null,
    }));

    const dataForAI = {
      employees: simplifiedEmployees,
      coupons: simplifiedCoupons,
    };
    const jsonData = JSON.stringify(dataForAI);

    // 2. Construct a detailed prompt for the AI.
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are an AI assistant for a Canteen Management System.
      Analyze the provided JSON data to answer the user's question about coupon usage.
      The current date is ${new Date().toISOString().split('T')[0]}.
      The JSON data contains two arrays: 'employees' and 'coupons'.
      - The 'employees' array links employee IDs to their roles, departments, and contractors.
      - The 'coupons' array contains records of every coupon, including its type, status, issue date, and redemption date.
      
      Provide a clear, concise, and helpful answer. Use bullet points for lists if it makes the answer clearer.

      JSON Data:
      ${jsonData}

      User's Question:
      "${question}"
    `;

    // 3. Call the Gemini API and handle the response.
    // Determine API key from environment or a global (if explicitly provided).
    const apiKey = (globalThis as any).__GENAI_API_KEY__ || (globalThis as any).process?.env?.API_KEY;

    if (!apiKey) {
      console.warn('GeminiService: API key not available in this runtime. Returning a placeholder message.');
      return 'AI service is not configured in this environment.';
    }

    try {
      // Dynamically import the server-side library only when needed.
      const mod = await import('@google/genai');
      const GoogleGenAI = (mod as any).GoogleGenAI;
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({ model: model, contents: prompt });
      return response.text;
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw new Error('Failed to get insights from the AI. The service may be temporarily unavailable.');
    }
  }
}
