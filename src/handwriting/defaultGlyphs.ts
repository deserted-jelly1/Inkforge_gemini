import { CharacterSample, RawSampleStroke } from './types';

/**
 * Creates a synthetic starter sample for a character with realistic cell guides.
 * Cell dimensions: 200 x 200 pt.
 * Baseline at y = 140.
 * Cap-height at y = 60 (height 80 units).
 * x-height at y = 96 (height 44 units).
 */
export function createStarterSample(char: string): CharacterSample {
  const baselineY = 140;
  const capHeightY = 60;
  const xHeightY = 96;

  // Generate basic stroke geometry matching character structure
  const strokes: RawSampleStroke[] = [];
  const color = '#0f172a';
  const baseWidth = 2.4;

  const makeStroke = (id: string, pts: [number, number][]): RawSampleStroke => ({
    id,
    baseWidth,
    color,
    points: pts.map(([x, y], idx) => ({
      x,
      y,
      pressure: 0.5 + Math.sin(idx / 3) * 0.15,
      tiltX: 0,
      tiltY: 0,
      timestamp: Date.now() + idx * 10,
    })),
  });

  // Basic print paths for starter profile
  if (char === 'a') {
    strokes.push(
      makeStroke('a_circle', [
        [135, 115], [115, 96], [95, 115], [95, 130], [115, 140], [135, 130], [135, 100],
      ]),
      makeStroke('a_stem', [[135, 98], [135, 140]])
    );
  } else if (char === 'b') {
    strokes.push(
      makeStroke('b_stem', [[75, 60], [75, 140]]),
      makeStroke('b_loop', [[75, 105], [95, 96], [125, 110], [125, 130], [95, 140], [75, 138]])
    );
  } else if (char === 'c') {
    strokes.push(
      makeStroke('c_arc', [[130, 106], [110, 96], [85, 115], [85, 128], [110, 140], [132, 132]])
    );
  } else if (char === 'd') {
    strokes.push(
      makeStroke('d_stem', [[135, 60], [135, 140]]),
      makeStroke('d_loop', [[135, 135], [115, 140], [85, 130], [85, 110], [115, 96], [135, 105]])
    );
  } else if (char === 'e') {
    strokes.push(
      makeStroke('e_stroke', [
        [85, 118], [135, 118], [135, 105], [115, 96], [85, 112], [85, 128], [115, 140], [135, 135],
      ])
    );
  } else if (char === 'f') {
    strokes.push(
      makeStroke('f_hook', [[120, 65], [105, 60], [95, 75], [95, 140]]),
      makeStroke('f_cross', [[80, 96], [115, 96]])
    );
  } else if (char === 'g') {
    strokes.push(
      makeStroke('g_loop', [[130, 115], [110, 96], [85, 112], [85, 128], [110, 140], [130, 130], [130, 98]]),
      makeStroke('g_tail', [[130, 100], [130, 160], [115, 175], [90, 172]])
    );
  } else if (char === 'h') {
    strokes.push(
      makeStroke('h_stem', [[80, 60], [80, 140]]),
      makeStroke('h_arch', [[80, 110], [105, 96], [125, 115], [125, 140]])
    );
  } else if (char === 'i') {
    strokes.push(
      makeStroke('i_stem', [[100, 98], [100, 140]]),
      makeStroke('i_dot', [[100, 80], [100, 82]])
    );
  } else if (char === 'j') {
    strokes.push(
      makeStroke('j_stem', [[110, 98], [110, 160], [95, 175], [80, 170]]),
      makeStroke('j_dot', [[110, 80], [110, 82]])
    );
  } else if (char === 'k') {
    strokes.push(
      makeStroke('k_stem', [[80, 60], [80, 140]]),
      makeStroke('k_diag1', [[120, 98], [80, 120]]),
      makeStroke('k_diag2', [[85, 116], [125, 140]])
    );
  } else if (char === 'l') {
    strokes.push(makeStroke('l_stem', [[100, 60], [100, 140]]));
  } else if (char === 'm') {
    strokes.push(
      makeStroke('m_stem', [[65, 98], [65, 140]]),
      makeStroke('m_arch1', [[65, 110], [85, 96], [105, 112], [105, 140]]),
      makeStroke('m_arch2', [[105, 110], [125, 96], [145, 112], [145, 140]])
    );
  } else if (char === 'n') {
    strokes.push(
      makeStroke('n_stem', [[75, 98], [75, 140]]),
      makeStroke('n_arch', [[75, 110], [100, 96], [125, 115], [125, 140]])
    );
  } else if (char === 'o') {
    strokes.push(
      makeStroke('o_circle', [
        [100, 96], [75, 115], [75, 128], [100, 140], [125, 128], [125, 115], [100, 96],
      ])
    );
  } else if (char === 'p') {
    strokes.push(
      makeStroke('p_stem', [[75, 98], [75, 175]]),
      makeStroke('p_loop', [[75, 105], [95, 96], [125, 110], [125, 130], [95, 140], [75, 138]])
    );
  } else if (char === 'q') {
    strokes.push(
      makeStroke('q_loop', [[125, 135], [105, 140], [80, 130], [80, 110], [105, 96], [125, 105]]),
      makeStroke('q_stem', [[125, 98], [125, 175]])
    );
  } else if (char === 'r') {
    strokes.push(
      makeStroke('r_stem', [[85, 98], [85, 140]]),
      makeStroke('r_arch', [[85, 112], [105, 96], [125, 104]])
    );
  } else if (char === 's') {
    strokes.push(
      makeStroke('s_curve', [
        [125, 106], [110, 96], [90, 105], [115, 120], [125, 130], [110, 140], [85, 135],
      ])
    );
  } else if (char === 't') {
    strokes.push(
      makeStroke('t_stem', [[95, 75], [95, 135], [105, 140]]),
      makeStroke('t_cross', [[80, 96], [115, 96]])
    );
  } else if (char === 'u') {
    strokes.push(
      makeStroke('u_cup', [[80, 98], [80, 130], [100, 140], [120, 130], [120, 98]]),
      makeStroke('u_stem', [[120, 105], [120, 140]])
    );
  } else if (char === 'v') {
    strokes.push(makeStroke('v_diag', [[75, 98], [100, 140], [125, 98]]));
  } else if (char === 'w') {
    strokes.push(
      makeStroke('w_lines', [[65, 98], [82, 140], [100, 108], [118, 140], [135, 98]])
    );
  } else if (char === 'x') {
    strokes.push(
      makeStroke('x_diag1', [[80, 98], [120, 140]]),
      makeStroke('x_diag2', [[120, 98], [80, 140]])
    );
  } else if (char === 'y') {
    strokes.push(
      makeStroke('y_diag1', [[80, 98], [100, 130]]),
      makeStroke('y_diag2', [[120, 98], [100, 130], [85, 175]])
    );
  } else if (char === 'z') {
    strokes.push(
      makeStroke('z_zig', [[80, 98], [120, 98], [80, 140], [120, 140]])
    );
  } else if (char === '.') {
    strokes.push(makeStroke('dot', [[100, 136], [100, 140]]));
  } else if (char === ',') {
    strokes.push(makeStroke('comma', [[100, 136], [98, 148], [92, 154]]));
  } else if (char === '!') {
    strokes.push(
      makeStroke('excl_stem', [[100, 60], [100, 120]]),
      makeStroke('excl_dot', [[100, 136], [100, 140]])
    );
  } else if (char === '?') {
    strokes.push(
      makeStroke('quest_hook', [
        [85, 80], [100, 60], [120, 75], [105, 95], [100, 105], [100, 118],
      ]),
      makeStroke('quest_dot', [[100, 136], [100, 140]])
    );
  } else if (char === '-') {
    strokes.push(makeStroke('hyphen', [[80, 118], [120, 118]]));
  } else if (char === "'") {
    strokes.push(makeStroke('quote', [[100, 60], [98, 72]]));
  } else if (char >= 'A' && char <= 'Z') {
    // Basic uppercase fallback geometry
    strokes.push(
      makeStroke('cap_v1', [[80, 60], [80, 140]]),
      makeStroke('cap_v2', [[80, 60], [120, 100], [80, 140]])
    );
  } else if (char >= '0' && char <= '9') {
    // Basic digit fallback geometry
    strokes.push(
      makeStroke('digit_loop', [
        [100, 60], [75, 85], [75, 115], [100, 140], [125, 115], [125, 85], [100, 60],
      ])
    );
  } else {
    // Generic fallback stroke
    strokes.push(makeStroke('generic', [[80, 100], [120, 100]]));
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const st of strokes) {
    for (const pt of st.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  return {
    id: `sample_${char}_starter`,
    createdAt: Date.now(),
    strokes,
    cellBounds: { minX, minY, maxX, maxY },
    baselineY,
    capHeightY,
    xHeightY,
  };
}

export function populateStarterAlphabet(): Record<string, CharacterSample[]> {
  const glyphs: Record<string, CharacterSample[]> = {};
  const standardChars = 'abcdefghijklmnopqrstuvwxyz.,!?-'.split('');
  for (const c of standardChars) {
    glyphs[c] = [createStarterSample(c)];
  }
  return glyphs;
}
