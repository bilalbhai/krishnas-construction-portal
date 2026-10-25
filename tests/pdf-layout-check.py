"""Check sample page boundaries after running scripts/pdf-design-samples.mjs."""
from pathlib import Path
from pypdf import PdfReader

support_sections = ["PAYMENT INSTRUCTIONS", "QUOTATION VALIDITY & DEPOSIT", "EXCLUSIONS", "MATERIAL ASSUMPTIONS", "CUSTOMER ACCEPTANCE", "TERMS & CONDITIONS"]
for kind in ["quote", "booking", "invoice"]:
    path = Path(__file__).resolve().parents[1] / "output" / "pdf" / f"krishnas-{kind}-design.pdf"
    reader = PdfReader(path)
    assert len(reader.pages) == 2, (kind, "expected pricing and supporting details pages")
    first = reader.pages[0].extract_text()
    second = reader.pages[1].extract_text()
    assert "Total AUD" in first
    positions = {}
    def visit(text, cm, tm, font, size):
        label = text.strip()
        if label in ["Net charges (ex GST)", "GST component", "Total AUD", "Deposit requested", "After requested deposit", "Balance due"]:
            positions[label] = (tm[4], tm[5])
    reader.pages[0].extract_text(visitor_text=visit)
    ordered = sorted(positions.values(), key=lambda point: -point[1])
    assert len(ordered) >= 3
    assert all(abs(x - 50) < 0.1 for x, y in ordered), (kind, "inconsistent totals alignment")
    assert all(ordered[i][1] - ordered[i+1][1] >= 20 for i in range(len(ordered)-1)), (kind, "totals too tightly spaced")
    for label in support_sections:
        assert label not in first, (kind, label, "leaked onto pricing page")
    assert "PAYMENT INSTRUCTIONS" in second
    assert "TERMS & CONDITIONS" in second
    if kind == "quote":
        for label in support_sections:
            assert label in second, (kind, label, "missing supporting detail")
    print(f"{kind}: pricing together on page 1; supporting sections on page 2")
