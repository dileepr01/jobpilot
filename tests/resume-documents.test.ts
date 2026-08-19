import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  createDocxResume,
  createPdfResume,
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

describe('resume document export', () => {
  it('creates a professional multi-page PDF for a senior resume', async () => {
    const bytes = await createPdfResume(resume)
    const pdf = await PDFDocument.load(bytes)

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2)
  })

  it('creates a non-empty DOCX using the same structured resume', async () => {
    const buffer = await Packer.toBuffer(createDocxResume(resume))

    expect(buffer.byteLength).toBeGreaterThan(5_000)
  })
})
