import type { AccessibilityIssue, Classification, ClassificationRule, ContentMetadataItem } from './types';

export class ViolationClassifier {
    constructor(
        private readonly contentMetadata: ContentMetadataItem[],
        private readonly rules: Record<string, ClassificationRule>,
    ) {}

    classify(violation: AccessibilityIssue): Classification {
        const rule = this.rules[violation.id];

        if (rule === undefined) {
            return { responsibility: 'unknown', hint: 'This issue requires investigation by a developer.' };
        }

        const classification: Classification = { responsibility: rule.responsibility, hint: rule.hint };

        if (rule.responsibility === 'editor') {
            classification.contentElementUid = this.findAffectedContentElement(violation);
        }

        return classification;
    }

    private findAffectedContentElement(violation: AccessibilityIssue): number | undefined {
        for (const node of violation.nodes) {
            for (const target of node.target) {
                const uid = this.extractContentElementUid(target);
                if (uid !== undefined) {
                    return uid;
                }
            }
        }

        return undefined;
    }

    private extractContentElementUid(selector: string): number | undefined {
        const match = selector.match(/#c(\d+)/);
        if (match === null) {
            return undefined;
        }

        const uid = parseInt(match[1], 10);
        const exists = this.contentMetadata.some((item) => item.uid === uid);

        return exists ? uid : undefined;
    }
}
