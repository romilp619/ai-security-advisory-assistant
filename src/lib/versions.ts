import semver from 'semver';
import { isLive, type AnyAdvisory, type Assessment } from './schema';
export const NOT_ESTABLISHED = 'Not established by available sources';

const unknown = (reason: string): Assessment => ({status: 'unknown', reason});

export function assessVersion(advisory: AnyAdvisory, version: string): Assessment {
  if (advisory.withdrawnAt) return unknown('This advisory was withdrawn. Review its original source.');
  if (!version) return unknown('No installed version supplied.');
  // npm publishes semver, so semver comparison is valid for the npm ecosystem.
  // Distribution and language ecosystems use different schemes and are not compared here.
  if (advisory.ecosystem !== 'npm') return unknown('This product’s version scheme is not supported. Only npm package versions are compared.');
  if (!semver.valid(version) || semver.prerelease(version) || version.includes('+')) {
    return unknown('Prereleases, vendor builds, backports, and ambiguous versions require source review.');
  }
  if (isLive(advisory) && advisory.comparability !== 'semver') {
    if (advisory.comparability === 'enumerated') {
      return advisory.exactVersions.includes(version)
        ? {status: 'conditional', reason: 'The source lists this exact version as affected. Deployment and configuration conditions still require verification in the source.'}
        : {status: 'outside-range', reason: 'The source lists affected versions individually and does not list this one. This does not establish that the software is safe.'};
    }
    return unknown('The source does not express affected versions as comparable semver ranges. Review the original advisory.');
  }
  const ranges = advisory.ranges.map(r => semver.validRange(r.affected.replace(/,\s*/g, ' ')));
  const unaffected = advisory.unaffectedRanges.map(r => semver.validRange(r.replace(/,\s*/g, ' ')));
  if (!ranges.length || ranges.some(r => !r) || unaffected.some(r => !r)) return unknown('Missing or uninterpretable version ranges.');
  const matches = ranges.some(r => semver.satisfies(version, r!));
  const explicitlyUnaffected = unaffected.some(r => semver.satisfies(version, r!));
  if (matches && explicitlyUnaffected) return {status: 'conflict', reason: 'Affected and explicitly unaffected ranges contradict each other.'};
  if (explicitlyUnaffected) return {status: 'unaffected', reason: 'The version is explicitly documented as unaffected by this advisory.'};
  if (!matches) return {status: 'outside-range', reason: 'Outside the documented affected ranges. This does not establish that the software is safe.'};
  if (!advisory.conditionsReviewed || advisory.conditions?.length) return {status: 'conditional', reason: 'The version matches an affected range. Deployment and configuration conditions still require verification in the source.'};
  return {status: 'affected', reason: 'The version matches a documented affected range; reviewed records specify no additional conditions.'};
}

/**
 * Cross-check this application's deterministic assessment against the source's own
 * version matcher. Disagreement is reported, never silently resolved.
 */
export function reconcileWithSource(assessment: Assessment, sourceMatched: boolean | null): Assessment {
  if (sourceMatched === null) return assessment;
  // "Could not evaluate" is not a contradiction. When this application cannot compare
  // the published ranges, the source's own verdict is reported as the only evidence,
  // and its inability to evaluate is stated rather than hidden.
  if (assessment.status === 'unknown') {
    return sourceMatched
      ? {status: 'conditional', reason: 'This application could not evaluate the published ranges (' + assessment.reason + '), but OSV.dev\u2019s version matcher returned this advisory for the supplied version. Deployment and configuration conditions still require verification in the source.'}
      : assessment;
  }
  const localMatched = assessment.status === 'conditional' || assessment.status === 'affected';
  if (localMatched === sourceMatched) return assessment;
  return {
    status: 'conflict',
    reason: sourceMatched
      ? 'OSV.dev matched this advisory to the supplied version, but the published ranges did not evaluate to a match here (' + assessment.reason + '). Review the original advisory.'
      : 'The published ranges evaluate as a match for this version, but OSV.dev did not return this advisory for it. Review the original advisory.',
  };
}

export function productMatches(software: string, advisory: AnyAdvisory) {
  const normalize = (s: string) => s.toLowerCase().replace(/[ ._-]/g, '');
  return [advisory.product, advisory.packageName].some(p => normalize(p) === normalize(software));
}
