import sys
from fpdf import FPDF

def create_pdf(input_md, output_pdf):
    with open(input_md, "r", encoding="utf-8") as f:
        lines = f.readlines()

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Courier", size=10)
    
    # Process text line by line
    for line in lines:
        # Strip newlines to avoid extra spacing
        line = line.rstrip('\n')
        # Replace tabs
        line = line.replace('\t', '    ')
        # Convert encoding to latin-1
        line = line.encode('latin-1', 'replace').decode('latin-1')
        
        # cell adds a line without wrapping. multi_cell does wrapping. 
        # Using cell is safer if horizontal space error occurs in multi_cell
        if not line:
            pdf.ln(5)  # add empty line
        else:
            pdf.cell(w=0, h=5, text=line, new_x="LMARGIN", new_y="NEXT")
        
    pdf.output(output_pdf)

if __name__ == "__main__":
    create_pdf("research/report.md", "research/report.pdf")
    print("Created research/report.pdf")
