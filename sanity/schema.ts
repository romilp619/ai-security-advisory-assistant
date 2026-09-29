import { defineType, defineField } from 'sanity';
const text = (name: string, type = 'string') => defineField({ name, type });
export const securityAdvisory = defineType({
  name: 'securityAdvisory', title: 'Security advisory', type: 'document',
  groups: [{name: 'advisory', default: true}, {name: 'evidence'}, {name: 'review'}],
  fields: [
    ...['advisoryId', 'cve', 'title', 'vendor', 'product', 'packageName', 'ecosystem'].map(n => defineField({ ...text(n), group: 'advisory' })),
    defineField({name: 'description', type: 'text', group: 'advisory'}),
    defineField({name: 'severity', type: 'string', options: {list: ['low', 'moderate', 'high', 'critical']}}),
    defineField({name: 'cvss', type: 'number', validation: r => r.min(0).max(10)}),
    defineField({name: 'ranges', type: 'array', of: [{type: 'object', fields: [text('affected'), text('fixed')]}]}),
    defineField({name: 'unaffectedRanges', type: 'array', of: [{type: 'string'}], group: 'review', description: 'Only explicit source statements. Never infer from absence in affected ranges.'}),
    defineField({name: 'conditions', type: 'array', of: [{type: 'string'}], group: 'review'}),
    defineField({name: 'conditionsReviewed', type: 'boolean', group: 'review', initialValue: false, description: 'Enable only after checking all deployment conditions. Source refresh resets this flag.'}),
    defineField({name: 'remediation', type: 'text', group: 'review'}),
    defineField({name: 'exploitation', type: 'object', fields: [text('status'), text('sourceUrl', 'url')], group: 'evidence'}),
    defineField({name: 'sourceUrl', type: 'url', group: 'evidence'}),
    defineField({name: 'references', type: 'array', of: [{type: 'url'}], group: 'evidence'}),
    ...['publishedAt', 'updatedAt', 'fetchedAt', 'withdrawnAt'].map(n => defineField({...text(n, 'datetime'), group: 'evidence'})),
    defineField({name: 'provenance', type: 'object', group: 'evidence', fields: [text('provider'), text('apiUrl', 'url'), text('sha256')]}),
  ],
  preview: { select: {title: 'title', subtitle: 'advisoryId'} },
});
