import "@testing-library/jest-dom/vitest";

(globalThis as { litDisableWarning?: Record<string, boolean> }).litDisableWarning = {
  ...(globalThis as { litDisableWarning?: Record<string, boolean> }).litDisableWarning,
  "class-field-shadowing": true,
};

(globalThis as { litDisableNativeSupportWarnings?: boolean }).litDisableNativeSupportWarnings = true;
