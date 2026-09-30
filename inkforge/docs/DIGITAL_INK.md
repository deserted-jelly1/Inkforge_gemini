# InkForge — Digital Ink Mathematics & Processing Pipeline

## 1. Overview
The digital ink pipeline is the core competitive differentiator of InkForge. When a user writes with a stylus on a graphics tablet, the hardware emits discrete event packets at 133–200 Hz. If drawn with naive linear segments ($P_i \to P_{i+1}$), the resulting stroke looks jagged, polygonized, and unnatural. 

InkForge solves this through a multi-stage real-time trajectory reconstruction algorithm.

---

## 2. Mathematical Pipeline

```text
Raw Digitizer Sample (x, y, p, t, tilt)
                │
                ▼
      [1. One Euro Filter]            <-- Jitter removal at low speed, zero-lag at high speed
                │
                ▼
  [2. Pressure Curve Shaping]         <-- Gamma power law: r(p) = r_min + (r_max - r_min) * p^gamma
                │
                ▼
  [3. Centripetal Catmull-Rom]        <-- C^1 continuous parametric spline interpolation
                │
                ▼
   [4. Adaptive Sub-Sampling]         <-- Step-size dynamically adjusted by local curvature
                │
                ▼
 [5. Variable-Width Ribbon Mesh]      <-- Normal-offset quads forming smooth antialiased stroke
```

---

## 3. Centripetal Catmull-Rom Spline Formulation

Standard uniform Catmull-Rom splines suffer from self-intersections and cusp loops when control points are spaced unevenly (typical when pen velocity changes abruptly). InkForge implements **Centripetal Catmull-Rom splines** ($\alpha = 0.5$):

Given four consecutive points $P_0, P_1, P_2, P_3$ and knot times $t_0, t_1, t_2, t_3$:
$$t_{i+1} = t_i + \|P_{i+1} - P_i\|^\alpha \quad (\alpha = 0.5)$$

The curve segment between $P_1$ and $P_2$ for parameter $t \in [t_1, t_2]$ is computed via recursive linear interpolations:
$$A_1 = \frac{t_1 - t}{t_1 - t_0} P_0 + \frac{t - t_0}{t_1 - t_0} P_1$$
$$A_2 = \frac{t_2 - t}{t_2 - t_1} P_1 + \frac{t - t_1}{t_2 - t_1} P_2$$
$$A_3 = \frac{t_3 - t}{t_3 - t_2} P_2 + \frac{t - t_2}{t_3 - t_2} P_3$$
$$B_1 = \frac{t_2 - t}{t_2 - t_0} A_1 + \frac{t - t_0}{t_2 - t_0} A_2$$
$$B_2 = \frac{t_3 - t}{t_3 - t_1} A_2 + \frac{t - t_1}{t_3 - t_1} A_3$$
$$C(t) = \frac{t_2 - t}{t_2 - t_1} B_1 + \frac{t - t_1}{t_2 - t_1} B_2$$

**Properties Guaranteed by Centripetal Formulation**:
- No self-intersections or cusps within curve segments.
- Continuous tangent vector ($C^1$ smoothness).
- Exact interpolation through all user control points $P_1, P_2$.

---

## 4. Latency vs. Smoothing Trade-off

| Filter Configuration | Latency Cost | Smoothing Quality | Use Case |
| :--- | :--- | :--- | :--- |
| **Raw Polylines** | 0 ms | Terrible (jagged) | Debugging digitizer only |
| **In-Flight Quad Approximation** | < 1 ms | Excellent | Live drawing scratchpad |
| **Post-Stroke Catmull-Rom** | 0 ms (pen up) | Pristine $C^1$ vector | Final committed stroke |
| **Heavy Gaussian / Moving Avg** | 20–50 ms | Sluggish (rubber-band) | **Strictly prohibited** |

InkForge maintains **zero perceptual latency** by drawing the most recent 2 points immediately as a straight tangent line, and retroactively replacing the prior segment with the evaluated Catmull-Rom spline as soon as the 3rd and 4th points arrive.
