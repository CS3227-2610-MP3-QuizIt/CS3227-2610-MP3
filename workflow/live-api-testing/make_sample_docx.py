"""Generate a reproducible ~500-word sample lecture DOCX for the model probe.

Builds a minimal but valid OOXML .docx (a zip with the required parts) by hand,
so no extra backend dependency is needed. The content is generic biology lecture
notes — no secrets, no PII — suitable for committing as a fixture and for feeding
through the backend's real extract_docx() in model_comparison_probe.py.

Run from the repository root:
    uv run python workflow/live-api-testing/make_sample_docx.py
Writes workflow/live-api-testing/sample-notes.docx.
"""

from __future__ import annotations

import os
import zipfile
from xml.sax.saxutils import escape

# ~500 words of realistic lecture content: headings + prose + a short list.
# Each tuple is (style, text); "Heading" renders as a bold-ish paragraph, but
# for extraction purposes everything is just paragraph text.
PARAGRAPHS: list[str] = [
    "Cellular Energy: Photosynthesis and Respiration",
    "Introduction",
    "All living cells require a continuous supply of energy to maintain their "
    "internal organisation, transport molecules across membranes, synthesise "
    "macromolecules, and reproduce. In most ecosystems this energy originates "
    "from sunlight, which photosynthetic organisms capture and convert into the "
    "chemical bonds of organic molecules. Heterotrophs then release that stored "
    "energy through respiration. Understanding both processes, and how they "
    "complement one another, is central to cell biology.",
    "Photosynthesis",
    "Photosynthesis occurs in the chloroplast, an organelle bounded by a double "
    "membrane and containing stacked thylakoid membranes surrounded by a fluid "
    "stroma. The overall process converts light energy into chemical energy "
    "stored in glucose, and it can be divided into two coordinated stages. The "
    "light-dependent reactions take place in the thylakoid membranes. Pigments "
    "such as chlorophyll absorb photons, exciting electrons that pass along an "
    "electron transport chain. Water molecules are split in a reaction called "
    "photolysis, which releases oxygen as a by-product and supplies replacement "
    "electrons. The energy carried by these electrons is used to produce ATP and "
    "to reduce NADP+ to NADPH.",
    "The light-independent reactions, also known as the Calvin cycle, occur in "
    "the stroma. Here the ATP and NADPH generated earlier are used to fix carbon "
    "dioxide into a three-carbon sugar, which is subsequently assembled into "
    "glucose and other carbohydrates. Because the Calvin cycle depends on the "
    "products of the light-dependent stage, the two stages are tightly linked, "
    "even though only one of them directly requires light.",
    "Cellular Respiration",
    "Cellular respiration releases the energy stored in glucose and transfers it "
    "to ATP, the usable energy currency of the cell. The first stage, glycolysis, "
    "occurs in the cytoplasm and splits one molecule of glucose into two "
    "molecules of pyruvate, producing a small net yield of ATP and NADH. When "
    "oxygen is available, pyruvate enters the mitochondrion. The Krebs cycle "
    "operates in the mitochondrial matrix, oxidising carbon compounds, releasing "
    "carbon dioxide, and generating NADH and FADH2. These electron carriers then "
    "donate electrons to the electron transport chain embedded in the inner "
    "mitochondrial membrane. As electrons move along the chain, protons are "
    "pumped across the membrane, creating a gradient whose energy drives ATP "
    "synthase to produce the majority of the cell's ATP.",
    "Key Comparisons",
    "Although photosynthesis and respiration are often described as opposites, "
    "they are better understood as complementary. The following points summarise "
    "the relationship:",
    "Photosynthesis stores energy in glucose; respiration releases it.",
    "Photosynthesis occurs in chloroplasts; aerobic respiration centres on mitochondria.",
    "Photosynthesis consumes carbon dioxide and water and produces oxygen; "
    "respiration consumes oxygen and glucose and produces carbon dioxide and "
    "water.",
    "Both processes rely on electron transport chains and the controlled movement "
    "of protons to generate ATP.",
    "Summary",
    "Together, photosynthesis and respiration form a cycle of energy capture and "
    "release that sustains nearly all life. Energy enters the living world when "
    "chloroplasts convert sunlight into chemical bonds, and it becomes available "
    "for cellular work when mitochondria break those bonds down again. Mastering "
    "the location, inputs, and outputs of each stage provides a foundation for "
    "studying metabolism, growth, and the flow of energy through ecosystems.",
]

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    "</Types>"
)

RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
    'Target="word/document.xml"/>'
    "</Relationships>"
)


def build_document_xml(paragraphs: list[str]) -> str:
    body = []
    for text in paragraphs:
        body.append('<w:p><w:r><w:t xml:space="preserve">' + escape(text) + "</w:t></w:r></w:p>")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>" + "".join(body) + "</w:body></w:document>"
    )


def main() -> None:
    out = os.path.join(os.path.dirname(__file__), "sample-notes.docx")
    document_xml = build_document_xml(PARAGRAPHS)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES)
        archive.writestr("_rels/.rels", RELS)
        archive.writestr("word/document.xml", document_xml)
    word_count = sum(len(p.split()) for p in PARAGRAPHS)
    print(f"Wrote {out} ({word_count} words across {len(PARAGRAPHS)} paragraphs)")


if __name__ == "__main__":
    main()
