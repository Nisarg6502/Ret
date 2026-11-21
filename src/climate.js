// Climate: one shared state that couples sun, heat, wind, blowing sand and dust.
// Wind speed follows a daily cycle (calm dawn, strongest mid-afternoon when convection mixes fast
// air down) times a slowly varying weather factor. Transport needs the friction velocity u* to
// exceed Bagnold's threshold (~0.23 m/s for 0.25 mm quartz, about 6.5 m/s at 10 m height).
import { gn } from './world.js';

const KAPPA = 0.41, Z0 = 1e-4, UT = 0.23; // von Karman, roughness length (m), threshold u* (m/s)
export const ustarFrom = (u10) => (KAPPA * u10) / Math.log(10 / Z0);

export function createClimate(windAngle) {
  const c = {
    dir: [1, 0], u10: 4, ustar: 0.15, transport: 0, gustT: 0, heat: 0, tSurf: 20, tAir: 22,
    dust: 0.09, cloudCov: 0.3, cloudOff: [0, 0], cloudWind: [6, 1], ripple: 0, devil: 0,
  };
  c.update = (dtReal, gameDt, day, hours, sun) => {
    const n = day + hours / 24;
    const windy = 0.7 + 0.75 * (0.5 + 0.5 * gn(n * 0.45, 3.3));
    const h = hours;
    const daily = 2.0 + 6.4 * Math.exp(-(((h - 15.2) / 4.3) ** 2)) + 1.2 * Math.exp(-(((h - 9.5) / 2) ** 2));
    c.u10 = daily * windy;
    const a = windAngle + 0.45 * gn(n * 0.9, 9.1) + 0.12 * Math.sin(n * 6.283 + 1.0);
    c.dir = [Math.cos(a), Math.sin(a)];
    c.ustar = ustarFrom(c.u10);
    // fraction of the field above threshold once gusts (up to ~1.5x) are included
    c.transport = Math.max(0, Math.min(1, (c.ustar * 1.45 - UT) / (UT * 0.9)));
    // surface energy balance, first order with ~1.5 h lag
    const ins = Math.max(0, sun[1]);
    const teq = 14 + 58 * Math.pow(ins, 0.8);
    c.tSurf = c.started ? c.tSurf + (teq - c.tSurf) * (1 - Math.exp(-gameDt / 5400)) : teq;
    c.started = true;
    c.tAir = 0.55 * c.tSurf + 0.45 * (22 + 14 * ins);
    c.heat = Math.max(0, Math.min(1, (c.tSurf - 38) / 26)); // drives shimmer, thermals, dust devils
    c.dust = 0.07 + 0.16 * Math.max(0, Math.min(1, (c.u10 - 6) / 7)) + 0.03 * c.heat;
    c.cloudCov = 0.12 + 0.4 * (0.5 + 0.5 * gn(n * 0.6, 21.7));
    c.cloudWind = [c.dir[0] * 9 + 4, c.dir[1] * 9 - 3];
    c.cloudOff[0] += (c.cloudWind[0] * (dtReal + gameDt * 0.02)) / 1000;
    c.cloudOff[1] += (c.cloudWind[1] * (dtReal + gameDt * 0.02)) / 1000;
    // ripples migrate downwind ~ proportional to sand flux (in wavelengths)
    c.ripple += gameDt * 0.004 * c.transport * c.transport;
    c.gustT += dtReal;
  };
  return c;
}
