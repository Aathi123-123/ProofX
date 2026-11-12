import sys
import markdown
from fpdf import FPDF, HTMLMixin

class PDF(FPDF, HTMLMixin):
    pass

def create_pdf(input_md, output_pdf):
    with open(input_md, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Convert Markdown to HTML
    html_content = markdown.markdown(md_text, extensions=['tables'])
    
    # Add some basic styling wrapping
    html = f"""
    <font face="Arial">
    {html_content}
    </font>
    """

    pdf = PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Render HTML to PDF
    pdf.write_html(html)
    
    pdf.output(output_pdf)

if __name__ == "__main__":
    create_pdf("research/report.md", "research/report.pdf")
    print("Created professional research/report.pdf")
