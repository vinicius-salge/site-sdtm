from docx import Document

doc = Document('Segurança de Dados no Vercel.docx')
with open('doc_content.txt', 'w', encoding='utf-8') as f:
    for para in doc.paragraphs:
        if para.text.strip():
            f.write(para.text + '\n')
print('Documento extraído para doc_content.txt')
