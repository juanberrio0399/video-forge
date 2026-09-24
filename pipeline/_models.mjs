// _models.mjs — la lista unica de modelos de Gemini que usa todo el pipeline, en orden de preferencia.
// Vive aparte porque Google retira y renombra modelos seguido: cuando uno muere responde 404 y los
// scripts caen al siguiente de la lista. Cambiar el modelo en un solo sitio en vez de en 20 archivos.
export const TEXT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
