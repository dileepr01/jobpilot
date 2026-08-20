import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  createDocxResume,
  createPdfResume,
  normalizeResumeForExport,
  Packer
} from '../lib/resume-documents'

const resume = `PALETY RAJA SAI DILEEP
Senior Software Engineer | Power BI / Microsoft Fabric Platform Administration
Bangalore, India | +91-8861505533 | paletydileepr@gmail.com | linkedin.com/in/dileep-palety

PROFESSIONAL SUMMARY
Senior BI platform engineer with 12+ years of enterprise analytics platform experience.

CORE COMPETENCIES
Power BI Administration | Microsoft Fabric | PowerShell | Governance | Gateways | Monitoring

PROFESSIONAL EXPERIENCE
Senior Software Engineer — Power BI / Fabric Platform Administration
Walmart Global Tech India, Bangalore | May 2022 – Present
• Administer enterprise-scale Power BI and Fabric environments supporting hundreds of thousands of users.
• Manage capacity health, workspace governance, gateway operations, tenant settings, and platform reliability.
• Build PowerShell and REST API automation for governance, cleanup, reporting, and operational controls.
• Implement monitoring and root-cause-analysis workflows across capacity, refresh, and gateway telemetry.
• Govern controlled Dev-to-UAT-to-Prod release processes for enterprise BI assets.
• Support critical incidents and collaborate with engineering and platform stakeholders.
• Maintain access, lifecycle, governance, audit, and security standards across business units.
• Mentor engineers and maintain operational runbooks and reusable administration standards.

Technology Lead — BI Platform Operations
Infosys Limited (Client: Caterpillar), Hyderabad | 2017 – 2022
• Led L3 operations for enterprise Power BI and Cognos platforms.
• Automated workspace provisioning and recurring platform administration.
• Supported migration, governance, monitoring, release, and incident-management programs.
• Trained developers and analysts on BI platform standards and self-service governance.

Associate IT Analyst — BI Platform Support
Caterpillar India, Hyderabad | 2013 – 2017
• Maintained enterprise Cognos infrastructure, monitoring, scheduled jobs, access, upgrades, and DR activities.
• Automated routine operational checks and supported performance troubleshooting.

EDUCATION
Bachelor of Technology (B.Tech), Computer Science & Engineering | 2009 – 2013
Marri Laxman Reddy Institute of Technology and Management, Hyderabad`

const flattenedResume = `PALETY RAJA SAI DILEEP | Data Visualization Platform Engineer | Page 1 PALETY RAJA SAI DILEEP DATA VISUALIZATION PLATFORM ENGINEER | Power BI & Microsoft Fabric | BI DevOps, Governance & Platform Reliability Bangalore, India | +91 8861505533 | paletydileepr@gmail.com | linkedin.com/in/dileep-palety PROFESSIONAL SUMMARY Data Visualization Platform Engineer with 12+ years of experience administering and scaling enterprise BI platforms. Lead Power BI and Microsoft Fabric platform engineering for 350,000+ users, 3,200+ workspaces, 32 capacities, and 200,000+ semantic models. CORE COMPETENCIES BI DevOps & CI/CD Power BI Deployment Pipelines; Git branching, pull requests and versioning; Azure DevOps; release governance; Dev/UAT/Prod promotion; REST/Admin APIs; XMLA Platform Engineering Power BI Service; Microsoft Fabric Admin Portal; tenant settings; scalability; reliability; cost optimization PROFESSIONAL EXPERIENCE Senior Software Engineer - Power BI / Fabric Platform Administration | Walmart Global Tech India Bangalore, India May 2022 - Present • Oversee an enterprise Power BI and Microsoft Fabric platform serving 350,000+ users. • Manage Dev-to-UAT-to-Prod deployment pipelines and release governance. PALETY RAJA SAI DILEEP | Data Visualization Platform Engineer | Page 2 PROFESSIONAL EXPERIENCE - CONTINUED Technology Lead - BI Platform Operations | Infosys Limited (Client: Caterpillar) Hyderabad, India 2017 - 2022 • Led L3 operations for enterprise Power BI and IBM Cognos platforms. Associate IT Analyst - BI Platform Support | Caterpillar India Hyderabad, India 2013 - 2017 • Maintained enterprise Cognos BI infrastructure and DR activities. EDUCATION & LANGUAGES Bachelor of Technology (B.Tech), Computer Science & Engineering Marri Laxman Reddy Institute of Technology and Management, Hyderabad | 2009 - 2013 | First Class with Distinction LANGUAGES Telugu - Native English - Professional Hindi - Conversational`

describe('resume document export', () => {
  it('repairs flattened running headers, sections, and bullets before export', () => {
    const normalized = normalizeResumeForExport(flattenedResume)
    const lines = normalized.split('\n')

    expect(lines[0]).toBe('PALETY RAJA SAI DILEEP')
    expect(lines[1]).toBe('Data Visualization Platform Engineer')
    expect(lines[2]).toContain('Bangalore, India')
    expect(lines[2]).toContain('paletydileepr@gmail.com')
    expect(normalized).not.toMatch(/Page\s+[12]/i)
    expect(
      normalized.match(/PALETY RAJA SAI DILEEP/g)?.length
    ).toBe(1)
    expect(normalized).toContain('\nPROFESSIONAL SUMMARY\n')
    expect(normalized).toContain('\nCORE COMPETENCIES\n')
    expect(normalized).toContain('\nPROFESSIONAL EXPERIENCE\n')
    expect(normalized).toContain('\n- Oversee an enterprise Power BI')
    expect(normalized).toContain('\nEDUCATION & LANGUAGES\n')
    expect(normalized).toContain('\nLANGUAGES\n')
  })

  it('creates a professional multi-page PDF for a senior resume', async () => {
    const bytes = await createPdfResume(resume)
    const pdf = await PDFDocument.load(bytes)

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2)
  })

  it('creates a PDF from the previously broken flattened format', async () => {
    const bytes = await createPdfResume(flattenedResume)
    const pdf = await PDFDocument.load(bytes)

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2)
  })

  it('creates a non-empty DOCX using the same structured resume', async () => {
    const buffer = await Packer.toBuffer(createDocxResume(resume))

    expect(buffer.byteLength).toBeGreaterThan(5_000)
  })
})
