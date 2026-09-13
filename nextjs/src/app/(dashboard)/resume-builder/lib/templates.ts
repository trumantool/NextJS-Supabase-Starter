// Resume Builder — seed resume templates as ProseMirror JSON.
import type { ResumeDoc } from './types'

export interface ResumeTemplate {
  id: string
  name: string
  description: string
  doc: ResumeDoc
}

const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})

const p = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

const bullet = (text: string) => ({
  type: 'listItem',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }],
    },
  ],
})

const bulletList = (items: string[]) => ({
  type: 'bulletList',
  content: items.map(bullet),
})

export const resumeTemplates: ResumeTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional, clean, and professional.',
    doc: {
      type: 'doc',
      content: [
        h(1, 'Your Name'),
        p('Professional Title'),
        p('email@example.com · (555) 123-4567 · City, State · linkedin.com/in/you'),
        h(2, 'Summary'),
        p('A brief, compelling summary of your professional background and key strengths.'),
        h(2, 'Experience'),
        p('Job Title — Company Name, City, State'),
        p('Month Year – Present'),
        bulletList([
          'Achievement or responsibility with measurable impact.',
          'Another key accomplishment.',
          'A third bullet highlighting a skill or result.',
        ]),
        p('Previous Job Title — Previous Company, City, State'),
        p('Month Year – Month Year'),
        bulletList([
          'Responsibility or achievement.',
          'Another accomplishment.',
        ]),
        h(2, 'Education'),
        p('Degree, Major — University Name, Year'),
        h(2, 'Skills'),
        bulletList(['Skill one', 'Skill two', 'Skill three']),
      ],
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold headings and a contemporary layout.',
    doc: {
      type: 'doc',
      content: [
        h(1, 'Your Name'),
        p('Product Designer · Portfolio: yoursite.com'),
        h(2, 'Profile'),
        p('Designer focused on user-centered products and clean visual systems.'),
        h(2, 'Experience'),
        p('Senior Product Designer — Acme Corp'),
        p('2021 – Present'),
        bulletList([
          'Led redesign of core product, improving activation by 25%.',
          'Built and maintained a design system used across 4 teams.',
        ]),
        h(2, 'Education'),
        p('BFA, Graphic Design — University of Design, 2019'),
        h(2, 'Skills'),
        bulletList(['Figma', 'Prototyping', 'Design Systems', 'User Research']),
      ],
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'One page, dense and efficient.',
    doc: {
      type: 'doc',
      content: [
        h(1, 'Your Name'),
        p('Software Engineer · email@example.com · (555) 123-4567'),
        h(2, 'Summary'),
        p('Engineer with 5+ years building scalable web applications.'),
        h(2, 'Experience'),
        p('Software Engineer — Tech Co, 2020 – Present'),
        bulletList([
          'Built features serving 1M+ users.',
          'Reduced API latency by 40%.',
        ]),
        h(2, 'Education'),
        p('BS, Computer Science — State University, 2019'),
        h(2, 'Skills'),
        bulletList(['TypeScript', 'React', 'Node.js', 'PostgreSQL']),
      ],
    },
  },
]

export function getTemplate(id: string): ResumeTemplate {
  return resumeTemplates.find((t) => t.id === id) ?? resumeTemplates[0]
}