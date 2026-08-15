/**
 * The NVP palette, ported from styles/tokens.css.
 *
 * The colour semantics are the same and just as strict: Value is always amber,
 * Position is always green, purple is the game itself (your turn, focus,
 * primary action). Nothing else uses those three, so a colour on screen means
 * exactly one thing.
 */

export const color = {
  purple300: '#D39BFF',
  purple400: '#C270FF',
  purple500: '#B24BFF',
  purple700: '#6C1FA8',
  purple900: '#2A0C42',

  green300: '#7CEBB4',
  green500: '#3DE08A',
  green700: '#1E9159',
  green900: '#0C3323',

  amber300: '#FAD98A',
  amber500: '#F5C451',
  amber700: '#A87C1C',
  amber900: '#3A2A0A',

  bg: '#0E0E11',
  bgDeep: '#08080A',
  panel: '#17171B',
  raised: '#1E1E24',
  sunken: '#121216',
  line: 'rgba(237,235,228,0.09)',
  lineStrong: 'rgba(237,235,228,0.18)',

  text: '#EDEBE4',
  muted: '#9A9AA6',
  faint: '#63636E',
};

// Role aliases — use these in components, not the raw ramp.
export const role = {
  value: color.amber500,
  valueDim: color.amber900,
  position: color.green500,
  positionDim: color.green900,
  accent: color.purple500,
  accentSoft: color.purple900,
};

export const font = {
  display: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
};

export const size = {
  micro: 11,
  small: 13,
  base: 15,
  large: 18,
  xl: 22,
  display: 30,
  hero: 40,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 30,
  xxl: 44,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

/** Reused text styles, so the eyebrow/mono conventions stay consistent. */
export const type = {
  eyebrow: {
    fontFamily: font.mono,
    fontSize: size.micro,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: color.muted,
  },
  body: {
    fontFamily: font.display,
    fontSize: size.base,
    color: color.text,
    lineHeight: 22,
  },
  muted: {
    fontFamily: font.display,
    fontSize: size.small,
    color: color.muted,
    lineHeight: 20,
  },
  title: {
    fontFamily: font.displayBold,
    fontSize: size.display,
    color: color.text,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: font.displayBold,
    fontSize: size.xl,
    color: color.text,
    letterSpacing: -0.4,
  },
};
