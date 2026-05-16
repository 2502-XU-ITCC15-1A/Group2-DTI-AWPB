export const UNIT_CODES = ["MOR", "LDN", "BKD", "RCU"];

const UNIT_ALIASES = {
  RCU: ["RCU", "REGIONAL COORDINATING UNIT"],
  BKD: ["BKD", "BUKIDNON"],
  LDN: ["LDN", "LANAO DEL NORTE"],
  MOR: ["MOR", "MIS OR", "MIS_OR", "MISAMIS ORIENTAL"],
};

const UNIT_CODE_BY_ALIAS = Object.entries(UNIT_ALIASES).reduce(
  (acc, [code, aliases]) => {
    aliases.forEach((alias) => {
      acc[alias] = code;
    });
    return acc;
  },
  {},
);

export function normalizeUnitCode(unit) {
  const normalized = String(unit || "").trim().toUpperCase();
  return UNIT_CODE_BY_ALIAS[normalized] || normalized || "N/A";
}

export function getUnitLookupValues(unit) {
  const code = normalizeUnitCode(unit);
  return [...new Set([unit, code, ...(UNIT_ALIASES[code] || [])].filter(Boolean))];
}
