from flask import Flask, render_template, request, jsonify, send_file, url_for
from werkzeug.utils import secure_filename
import pytesseract
from PIL import Image
import os, time, uuid
from io import BytesIO
from threading import Timer

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# in-memory store: id -> {"text": str, "duration": float, "timestamp": float}
extracted_texts = {}

AUTO_DELETE_SECONDS = 24 * 3600  # 24 hours


def schedule_auto_delete(text_id, delay=AUTO_DELETE_SECONDS):
    def delete_fn():
        extracted_texts.pop(text_id, None)
        print(f"[AUTO DELETE] Removed {text_id}")
    Timer(delay, delete_fn).start()


@app.route("/")
def index():
    # just render template
    return render_template("index.html")


@app.route("/extract", methods=["POST"])
def extract():
    # Expect multiple files under field "image"
    if "image" not in request.files:
        return jsonify({"error": "No files uploaded (field 'image')"}), 400

    files = request.files.getlist("image")
    results = []

    for file in files:
        if not file or file.filename == "":
            continue

        filename = secure_filename(file.filename)
        tmp_name = f"{uuid.uuid4().hex}_{filename}"
        tmp_path = os.path.join(UPLOAD_FOLDER, tmp_name)
        file.save(tmp_path)

        start = time.time()
        try:
            img = Image.open(tmp_path)
            text = pytesseract.image_to_string(img)
        except Exception as e:
            text = f"[OCR error: {str(e)}]"
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        duration = round(time.time() - start, 2)
        text_id = uuid.uuid4().hex
        extracted_texts[text_id] = {
            "text": text,
            "duration": duration,
            "timestamp": time.time()
        }

        schedule_auto_delete(text_id)

        results.append({
            "id": text_id,
            "text": text,
            "duration": duration
        })

    return jsonify(results)


@app.route("/delete/<text_id>", methods=["DELETE"])
def delete_text(text_id):
    if text_id in extracted_texts:
        del extracted_texts[text_id]
        return jsonify({"message": "Deleted successfully"})
    return jsonify({"error": "Not found"}), 404


@app.route("/download/<text_id>", methods=["GET"])
def download_text(text_id):
    item = extracted_texts.get(text_id)
    if not item:
        return jsonify({"error": "Not found"}), 404
    content = item["text"] or ""
    fname = f"extracted_{text_id[:8]}.txt"
    buf = BytesIO()
    buf.write(content.encode("utf-8"))
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=fname, mimetype="text/plain")


@app.errorhandler(500)
def handle_500(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    # debug True is fine for development in Replit; set False for production.
    app.run(host="0.0.0.0", port=3000, debug=True)