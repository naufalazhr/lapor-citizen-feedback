/**
 * Provider logo components using real brand assets from /src/assets.
 * Only Stoneart has no asset — that card falls back to a lucide icon.
 * All wrappers use w-full h-full so the 48×48 card container controls the size.
 */

import flowiseLogo   from "@/assets/flowise-ai-logo-p.jpg";
import openrouterLogo from "@/assets/openrouter.png";
import openaiLogo    from "@/assets/openai.png";
import geminiLogo    from "@/assets/gemini-rainbow-star-x-logo.jpg";
import fonnteLogo    from "@/assets/fonnte.png";
import cekatLogo     from "@/assets/cekat_logo.B7S8vS79.png";
import infobipLogo   from "@/assets/Infobip-Logo.wine.png";
import twilioLogo    from "@/assets/Twilio_logo.png";

/** Flowise — white-background wordmark logo */
export const FlowiseLogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-1.5">
    <img src={flowiseLogo} alt="Flowise" className="w-full h-full object-contain" />
  </div>
);

/** OpenRouter — white-background routing-arrows icon */
export const OpenRouterLogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-2">
    <img src={openrouterLogo} alt="OpenRouter" className="w-full h-full object-contain" />
  </div>
);

/** OpenAI — white-background OpenAI wordmark + knot icon */
export const OpenAILogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-1.5">
    <img src={openaiLogo} alt="OpenAI" className="w-full h-full object-contain" />
  </div>
);

/** Google Gemini — light-gray-background rainbow star + wordmark */
export const GeminiLogo = () => (
  <div className="w-full h-full bg-[#eef0f5] flex items-center justify-center p-1.5">
    <img src={geminiLogo} alt="Gemini" className="w-full h-full object-contain" />
  </div>
);

/** Fonnte — white-background navy wordmark */
export const FonnteLogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-1.5">
    <img src={fonnteLogo} alt="Fonnte" className="w-full h-full object-contain" />
  </div>
);

/** Cekat.AI — white-background blue gradient wordmark */
export const CekatLogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-1.5">
    <img src={cekatLogo} alt="Cekat.AI" className="w-full h-full object-contain" />
  </div>
);

/** Infobip — white-background orange circle + wordmark */
export const InfobipLogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-1">
    <img src={infobipLogo} alt="Infobip" className="w-full h-full object-contain" />
  </div>
);

/** Twilio — white-background red circle icon + wordmark */
export const TwilioLogo = () => (
  <div className="w-full h-full bg-white flex items-center justify-center p-1">
    <img src={twilioLogo} alt="Twilio" className="w-full h-full object-contain" />
  </div>
);
