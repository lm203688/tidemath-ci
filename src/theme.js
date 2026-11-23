// TideMath theme — sea-glass light palette, readable in daylight.
export const colors = {
  bg: '#F2F6F5',
  card: '#FFFFFF',
  ink: '#0B2A33',
  sub: '#5A7078',
  line: '#DCE6E3',
  teal: '#0F766E',
  tealSoft: '#E3F1EF',
  amber: '#B45309',
  amberSoft: '#FDF0DF',
  navy: '#0B2A33',
  danger: '#B42318',
  night: '#0B1F26',
};

export const radius = { card: 18, pill: 999, chip: 12 };

export const type = {
  hero: { fontSize: 44, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  small: { fontSize: 12, color: colors.sub, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: '700', color: colors.sub, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export const shadow = {
  shadowColor: '#07252B',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
