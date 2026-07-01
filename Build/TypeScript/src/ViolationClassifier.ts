import type { AccessibilityIssue, Classification, ClassificationRule } from './types';

export class ViolationClassifier {
  constructor(private readonly rules: Record<string, ClassificationRule>) {}

  classify(violation: AccessibilityIssue): Classification {
    const rule = this.rules[violation.id];
    if (rule === undefined) {
      return { responsibility: 'unknown', hint: 'This issue requires investigation by a developer.' };
    }

    if (rule.responsibility !== 'editor') {
      return { responsibility: 'developer', hint: rule.hint };
    }

    const match = violation.nodes.find((node) => node.contentElementUid !== undefined);
    if (match?.contentElementUid === undefined || match.dataAvailable === true) {
      return { responsibility: 'developer', hint: rule.developerHint ?? rule.hint };
    }

    return { responsibility: 'editor', hint: rule.hint, contentElementUid: match.contentElementUid };
  }
}
