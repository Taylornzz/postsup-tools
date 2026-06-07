// Feature flags — flip a value to re-enable a temporarily hidden feature.
//
// vendors: the Vendor Directory. Hidden for now from the menu, the Home launcher
//   and the "Continue" shortcut. The component, data and route still exist, so
//   re-enabling is just `vendors: true` (no code to restore).
export const FEATURES = {
  vendors: false,
} as const;
