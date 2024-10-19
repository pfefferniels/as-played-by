import json
from flask import Flask, request, jsonify
import numpy
import parangonar as pa
import partitura as pt
import os
import tempfile

app = Flask(__name__)

@app.route('/align', methods=['POST'])
def align():
    print('received', jsonify(request.form))
    if 'mei' not in request.form or 'midi' not in request.form:
        return jsonify({'error': 'Both MEI and MIDI files are required'}), 400

    mei_file = request.form['mei']
    # midi_file = request.files['midi']

    with tempfile.NamedTemporaryFile(delete=False, suffix='.mei') as temp_mei:
        temp_mei.write(mei_file.encode('utf-8'))
        mei_path = temp_mei.name

    try:
        score = pt.load_score(filename=mei_path)
        sna = score.note_array()

        fields = [
            ("onset_sec", "f4"),
            ("duration_sec", "f4"),
            ("onset_tick", "i4"),
            ("duration_tick", "i4"),
            ("pitch", "i4"),
            ("velocity", "i4"),
            ("track", "i4"),
            ("channel", "i4"),
            ("id", "U256"),
        ]

        midi_data = json.loads(request.form['midi'])
        pna = numpy.array([tuple(entry) for entry in midi_data], dtype=fields)

        sdm = pa.AutomaticNoteMatcher()
        pred_alignment = sdm(sna, pna)

        response = jsonify(pred_alignment)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    finally:
        os.remove(mei_path)

if __name__ == '__main__':
    app.run(debug=True)