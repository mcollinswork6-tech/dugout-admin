/**
 * ui.format Schema & Brand Design Tokens
 * Derived from the official dugout-admin icon (icon.jpeg)
 * Enforces visual consistency, color fidelity, and asset styling across Dugout Admin.
 */

export const UI_FORMAT = {
  version: '1.0.0',
  brand: {
    name: 'dugout-admin',
    displayName: 'NNLL Minor AAA Dugout & Lineup Optimizer',
    shortName: 'Dugout Admin',
    badgeText: 'NNLL MINOR AAA',
    slogan: 'Coaches & Managers Defensive Rotation Optimizer',
    logo: {
      assetPath: 'icon.jpeg',
      format: 'image/jpeg',
      dimensions: { width: 1024, height: 1024, aspectRatio: '1:1' },
      shape: 'squircle',
      borderRadiusRatio: 0.22,
      variants: {
        favicon: { width: 32, height: 32, borderRadius: '6px' },
        appleTouchIcon: { width: 180, height: 180, borderRadius: '36px' },
        header: {
          width: 40,
          height: 40,
          borderRadius: '9px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
        },
        auth: {
          width: 84,
          height: 84,
          borderRadius: '18px',
          boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.6), 0 0 20px rgba(249, 115, 22, 0.25)',
          border: '2px solid rgba(249, 115, 22, 0.4)',
        },
        modal: {
          width: 32,
          height: 32,
          borderRadius: '7px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        },
        splash: {
          width: 96,
          height: 96,
          borderRadius: '20px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
          border: '2px solid rgba(255, 255, 255, 0.18)',
        },
        print: {
          width: 48,
          height: 48,
          borderRadius: '8px',
          boxShadow: 'none',
          border: '1px solid #cbd5e1',
        },
      },
    },
  },
  palette: {
    brandOrange: '#f97316',
    brandOrangeHover: '#ea580c',
    brandOrangeGlow: 'rgba(249, 115, 22, 0.35)',
    deepNavy: '#0a1120',
    shieldBlue: '#173b7a',
    shieldBlueLight: '#2563eb',
    shieldBlueDark: '#0f1f3d',
    fieldGreen: '#22c55e',
    fieldGreenDark: '#15803d',
    fieldGreenBg: 'rgba(34, 197, 94, 0.15)',
    infieldDirt: '#d8b175',
    infieldDirtDark: '#b4833e',
    infieldDirtBg: 'rgba(216, 177, 117, 0.18)',
    baseballRed: '#ef4444',
    baseballRedDark: '#dc2626',
    baseballRedBg: 'rgba(239, 68, 68, 0.18)',
    metallicWhite: '#ffffff',
    metallicSilver: '#e2e8f0',
    badgeBronze: '#d4af37',
    bgPrimary: '#0f172a',
    bgSecondary: '#1e293b',
    borderDefault: '#334155',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
  },
  typography: {
    fontBrand: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

/**
 * Validates a UI component or theme against the ui.format schema rules.
 * @param {Object} candidate - Candidate configuration or style object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUIFormat(candidate) {
  const errors = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Candidate must be a valid configuration object'] };
  }

  // Check logo rules if logo candidate is supplied
  if (candidate.logo) {
    if (!candidate.logo.assetPath || !candidate.logo.assetPath.endsWith('.jpeg')) {
      errors.push('Logo must reference the official icon.jpeg asset.');
    }
    if (candidate.logo.dimensions && candidate.logo.dimensions.aspectRatio !== '1:1') {
      errors.push('Logo aspect ratio must be strictly 1:1 square.');
    }
  }

  // Check color palette minimum requirements if palette candidate is supplied
  if (candidate.palette) {
    const requiredColors = ['brandOrange', 'shieldBlue', 'bgPrimary'];
    for (const colorKey of requiredColors) {
      if (!candidate.palette[colorKey]) {
        errors.push(`Missing mandatory brand color token: ${colorKey}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates CSS custom properties matching the ui.format schema tokens.
 * @returns {Record<string, string>}
 */
export function getCSSCustomProperties() {
  return {
    '--brand-logo-url': `url('${UI_FORMAT.brand.logo.assetPath}')`,
    '--brand-orange': UI_FORMAT.palette.brandOrange,
    '--brand-orange-hover': UI_FORMAT.palette.brandOrangeHover,
    '--brand-orange-glow': UI_FORMAT.palette.brandOrangeGlow,
    '--brand-navy-deep': UI_FORMAT.palette.deepNavy,
    '--brand-shield-blue': UI_FORMAT.palette.shieldBlue,
    '--brand-shield-blue-light': UI_FORMAT.palette.shieldBlueLight,
    '--brand-shield-blue-dark': UI_FORMAT.palette.shieldBlueDark,
    '--brand-field-green': UI_FORMAT.palette.fieldGreen,
    '--brand-infield-dirt': UI_FORMAT.palette.infieldDirt,
    '--brand-baseball-red': UI_FORMAT.palette.baseballRed,
    '--brand-metallic-white': UI_FORMAT.palette.metallicWhite,
    '--brand-metallic-silver': UI_FORMAT.palette.metallicSilver,
    '--brand-badge-bronze': UI_FORMAT.palette.badgeBronze,
    '--font-brand': UI_FORMAT.typography.fontBrand,
  };
}
