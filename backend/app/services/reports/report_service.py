"""PSDE – Forensic PDF & JSON Report Generation Service"""
from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Case, EvidenceArtifact, MerkleCommitment, AuditEvent


async def generate_case_summary_report(db: AsyncSession, case_id: str) -> bytes:
    """Generate a formal forensic investigation summary PDF report."""
    # Query case
    case_res = await db.execute(select(Case).where((Case.id == case_id) | (Case.case_number == case_id)))
    case = case_res.scalar_one_or_none()
    if not case:
        raise ValueError("Case not found.")

    # Query evidence
    ev_res = await db.execute(select(EvidenceArtifact).where(EvidenceArtifact.case_id == case.id).order_by(EvidenceArtifact.artifact_id.asc()))
    evidence_list = ev_res.scalars().all()

    # Query commitments
    comm_res = await db.execute(select(MerkleCommitment).where(MerkleCommitment.case_id == case.id).order_by(MerkleCommitment.dataset_version.desc()))
    commitments = comm_res.scalars().all()

    # Query audits
    audit_res = await db.execute(select(AuditEvent).where(AuditEvent.case_id == case.id).order_by(AuditEvent.timestamp.desc()).limit(15))
    audit_events = audit_res.scalars().all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
    )
    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#00a87d'),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b'),
    )
    code_style = ParagraphStyle(
        'CodeText',
        parent=styles['Code'],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#0f172a'),
    )

    elements = []

    # Header / Title
    elements.append(Paragraph("<b>PROOFX FORENSIC EVIDENCE REPORT</b>", title_style))
    elements.append(Paragraph(f"Cryptographic Digital Forensics Platform &bull; Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", subtitle_style))
    elements.append(Spacer(1, 15))

    # Case Overview Table
    overview_data = [
        [Paragraph("<b>Case Number:</b>", body_style), Paragraph(case.case_number, body_style),
         Paragraph("<b>Status:</b>", body_style), Paragraph(case.status, body_style)],
        [Paragraph("<b>Case Name:</b>", body_style), Paragraph(case.case_name, body_style),
         Paragraph("<b>Created:</b>", body_style), Paragraph(case.created_at.strftime("%Y-%m-%d %H:%M"), body_style)],
        [Paragraph("<b>Purpose:</b>", body_style), Paragraph(case.investigation_purpose, body_style),
         Paragraph("<b>Total Artifacts:</b>", body_style), Paragraph(str(len(evidence_list)), body_style)],
    ]
    t_overview = Table(overview_data, colWidths=[80, 200, 80, 170])
    t_overview.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_overview)
    elements.append(Spacer(1, 15))

    # Evidence Inventory
    elements.append(Paragraph("1. Evidence Inventory &amp; SHA-256 Commitments", h2_style))
    ev_table_data = [["Artifact ID", "Filename", "Sensitivity", "SHA-256 Digest", "Status"]]
    for ev in evidence_list[:25]:
        sha_short = f"{ev.sha256[:16]}...{ev.sha256[-12:]}" if len(ev.sha256) > 28 else ev.sha256
        ev_table_data.append([
            Paragraph(ev.artifact_id, body_style),
            Paragraph(ev.filename, body_style),
            Paragraph(ev.sensitivity_level, body_style),
            Paragraph(sha_short, code_style),
            Paragraph(ev.status, body_style),
        ])
    if not evidence_list:
        ev_table_data.append(["No evidence items recorded", "-", "-", "-", "-"])

    t_ev = Table(ev_table_data, colWidths=[70, 130, 75, 185, 70])
    t_ev.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_ev)
    elements.append(Spacer(1, 15))

    # Merkle Commitments & Blockchain Anchors
    elements.append(Paragraph("2. Merkle Root Trees &amp; Blockchain Commitments", h2_style))
    comm_table_data = [["Version", "Evidence Count", "Merkle Root", "Tx Hash", "Timestamp"]]
    for c in commitments[:10]:
        root_short = f"{c.merkle_root[:16]}...{c.merkle_root[-10:]}"
        tx_short = f"{c.tx_hash[:14]}..." if c.tx_hash else "Unanchored"
        ts_str = c.blockchain_timestamp.strftime("%Y-%m-%d %H:%M") if c.blockchain_timestamp else c.created_at.strftime("%Y-%m-%d %H:%M")
        comm_table_data.append([
            f"v{c.dataset_version}",
            str(c.evidence_count),
            Paragraph(root_short, code_style),
            Paragraph(tx_short, code_style),
            ts_str,
        ])
    if not commitments:
        comm_table_data.append(["-", "0", "No commitments", "-", "-"])

    t_comm = Table(comm_table_data, colWidths=[55, 80, 175, 120, 100])
    t_comm.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_comm)
    elements.append(Spacer(1, 15))

    # Chain of Custody & Audit Trail
    elements.append(Paragraph("3. Immutable Chain of Custody (Recent Events)", h2_style))
    audit_data = [["Timestamp (UTC)", "Event", "Actor", "Details Hash"]]
    for a in audit_events:
        d_hash = f"{a.details_hash[:16]}..." if a.details_hash else "-"
        audit_data.append([
            a.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            Paragraph(a.event_type, body_style),
            a.actor_label,
            Paragraph(d_hash, code_style),
        ])
    if not audit_events:
        audit_data.append(["-", "No events logged", "-", "-"])

    t_audit = Table(audit_data, colWidths=[110, 170, 100, 150])
    t_audit.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_audit)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


async def generate_verification_report_pdf(verification_result: dict[str, Any]) -> bytes:
    """Generate a formal PDF Verification Certificate."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CertTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a'),
    )
    status_passed = verification_result.get("overall_status") == "VERIFIED"
    status_color = colors.HexColor('#16a34a') if status_passed else colors.HexColor('#dc2626')

    elements = [
        Paragraph("<b>PROOFX FORENSIC VERIFICATION CERTIFICATE</b>", title_style),
        Paragraph(f"Official Cryptographic Audit Result &bull; Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", styles['Normal']),
        Spacer(1, 15),
    ]

    status_text = "VERIFICATION PASSED - INTEGRITY CONFIRMED" if status_passed else f"VERIFICATION FAILED ({verification_result.get('overall_status')})"
    t_status = Table([[Paragraph(f"<b>{status_text}</b>", ParagraphStyle('St', parent=styles['Normal'], fontSize=12, textColor=colors.white))]], colWidths=[530])
    t_status.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), status_color),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_status)
    elements.append(Spacer(1, 15))

    details = [
        ["Artifact ID:", str(verification_result.get("artifact_id", "-"))],
        ["Computed Hash (SHA-256):", str(verification_result.get("computed_hash", "-"))],
        ["Expected Hash:", str(verification_result.get("expected_hash", "-"))],
        ["Hash Match:", "TRUE" if verification_result.get("hash_match") else "FALSE"],
        ["Merkle Proof Valid:", "TRUE" if verification_result.get("merkle_proof_valid") else "FALSE"],
        ["Blockchain Anchored:", "TRUE" if verification_result.get("blockchain_verified") else "FALSE"],
        ["Blockchain Tx Hash:", str(verification_result.get("blockchain_tx_hash", "None"))],
        ["Dataset Version:", str(verification_result.get("dataset_version", "-"))],
    ]
    t_details = Table(details, colWidths=[160, 370])
    t_details.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('FONTNAME', (1,1), (1,2), 'Courier'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_details)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

