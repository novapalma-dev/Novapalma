#!/usr/bin/env python3
import sys
import qrcode
from PIL import Image, ImageDraw, ImageFont

def generate_flyer(url="https://novapalma.vercel.app", output_path="/home/asher/workspace/Novapalma/landing/Stand_Novapalma_Listo_Para_Imprimir.jpg"):
    template_path = "/home/asher/Descargas/WhatsApp Image 2026-10-27 at 8.14.21 PM.jpeg"
    im = Image.open(template_path).convert("RGB")
    draw = ImageDraw.Draw(im)

    font_path = "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf"
    
    # 1. Texto en el cuadro azul/cian (Nombre del Emprendimiento)
    # Cyan box bounds: X: 108 a 923 (ancho 815, centro 515), Y: 365 a 475 (alto 110, centro 420)
    title_text = "NOVAPALMA"
    subtitle_text = "Logística & Trazabilidad Palmicultora"
    
    font_title = ImageFont.truetype(font_path, 54)
    font_sub = ImageFont.truetype(font_path, 22)
    
    # Bounding boxes para centrar
    tb_title = draw.textbbox((0, 0), title_text, font=font_title)
    w_title = tb_title[2] - tb_title[0]
    h_title = tb_title[3] - tb_title[1]
    
    tb_sub = draw.textbbox((0, 0), subtitle_text, font=font_sub)
    w_sub = tb_sub[2] - tb_sub[0]
    h_sub = tb_sub[3] - tb_sub[1]
    
    center_x = 515
    y_title = 380
    y_sub = y_title + h_title + 14
    
    # Sombra sutil para máxima legibilidad
    draw.text((center_x - w_title // 2 + 2, y_title + 2), title_text, fill=(0, 90, 90), font=font_title)
    draw.text((center_x - w_title // 2, y_title), title_text, fill=(255, 255, 255), font=font_title)
    
    draw.text((center_x - w_sub // 2, y_sub), subtitle_text, fill=(230, 255, 255), font=font_sub)

    # 2. Texto en el cuadro verde (Programa Académico)
    # Green box bounds: X: 169 a 877, Y: 485 a 555. "Programa:" ocupa de 169 a 403.
    # El texto del programa va de 415 a 870, centrado verticalmente alrededor de Y=520
    prog_text = "Ingeniería de Sistemas"
    font_prog = ImageFont.truetype(font_path, 34)
    
    tb_prog = draw.textbbox((0, 0), prog_text, font=font_prog)
    h_prog = tb_prog[3] - tb_prog[1]
    
    draw.text((420, 520 - h_prog // 2), prog_text, fill=(255, 255, 255), font=font_prog)

    # 3. Código QR en el cuadro blanco
    # Box bounds: X: 287 a 743 (ancho 456), Y: 760 a 1195 (alto 435)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    
    # Redimensionar para que quepa perfectamente con margen dentro del recuadro
    target_box_w = 743 - 287
    target_box_h = 1195 - 760
    
    qr_size = min(target_box_w, target_box_h) - 30 # 15px margen interno
    qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
    
    paste_x = 287 + (target_box_w - qr_size) // 2
    paste_y = 760 + (target_box_h - qr_size) // 2
    
    im.paste(qr_img, (paste_x, paste_y))

    # Guardar en JPEG alta calidad y PDF
    im.save(output_path, "JPEG", quality=98)
    pdf_path = output_path.replace(".jpg", ".pdf")
    im.save(pdf_path, "PDF", resolution=300.0)
    
    print(f"✅ Afiche generado exitosamente:")
    print(f"   Imagen: {output_path}")
    print(f"   PDF:    {pdf_path}")
    print(f"   URL QR: {url}")

if __name__ == "__main__":
    url_target = sys.argv[1] if len(sys.argv) > 1 else "https://novapalma.vercel.app"
    generate_flyer(url_target)
