#!/usr/bin/env python3
"""
MarkItDown PDF Parser Service
A Flask-based REST API for parsing documents using Microsoft's MarkItDown library
"""

import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import tempfile
import mimetypes

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from markitdown import MarkItDown

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configuration
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', 52428800))  # 50MB default
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', '/tmp/uploads')
PORT = int(os.getenv('PORT', 5000))

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt',
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'html', 'htm',
    'txt', 'md', 'csv'
}

# Ensure upload folder exists
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

# Initialize MarkItDown
md_converter = MarkItDown()


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_metadata(filepath: str, result: Any) -> Dict[str, Any]:
    """
    Extract comprehensive metadata from the file and MarkItDown result
    Handles missing or invalid dates gracefully
    """
    stat = os.stat(filepath)
    filename = os.path.basename(filepath)

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(filepath)

    # Extract dates with fallbacks
    created_date = None
    modified_date = None
    warnings = []

    try:
        # Try to get dates from MarkItDown result if available
        if hasattr(result, 'metadata') and result.metadata:
            created_date = result.metadata.get('created_date')
            modified_date = result.metadata.get('modified_date')

        # Fallback to file system dates
        if not created_date:
            created_date = datetime.fromtimestamp(stat.st_ctime).isoformat() + 'Z'
            warnings.append("Creation date not found in document, using file system date")

        if not modified_date:
            modified_date = datetime.fromtimestamp(stat.st_mtime).isoformat() + 'Z'
            warnings.append("Modified date not found in document, using file system date")

    except Exception as e:
        logger.warning(f"Error extracting dates: {e}")
        # Use current time as last resort
        current_time = datetime.utcnow().isoformat() + 'Z'
        created_date = created_date or current_time
        modified_date = modified_date or current_time
        warnings.append(f"Date extraction failed: {str(e)}, using current timestamp")

    metadata = {
        'filename': filename,
        'size': stat.st_size,
        'mimeType': mime_type or 'application/octet-stream',
        'createdDate': created_date,
        'modifiedDate': modified_date,
    }

    # Add additional metadata from MarkItDown result
    if hasattr(result, 'metadata') and result.metadata:
        if 'author' in result.metadata:
            metadata['author'] = result.metadata['author']
        if 'pages' in result.metadata:
            metadata['pages'] = result.metadata['pages']
        if 'title' in result.metadata:
            metadata['title'] = result.metadata['title']
        if 'subject' in result.metadata:
            metadata['subject'] = result.metadata['subject']

    return metadata, warnings


def parse_document(filepath: str) -> Dict[str, Any]:
    """
    Parse a document using MarkItDown and return structured data
    """
    try:
        logger.info(f"Parsing document: {filepath}")

        # Convert to markdown
        result = md_converter.convert(filepath)

        # Extract metadata
        metadata, warnings = extract_metadata(filepath, result)

        # Get markdown content
        markdown_content = result.text_content if hasattr(result, 'text_content') else str(result)

        return {
            'success': True,
            'data': {
                'markdown': markdown_content,
                'metadata': metadata,
                'warnings': warnings
            }
        }

    except Exception as e:
        logger.error(f"Error parsing document: {e}", exc_info=True)
        return {
            'success': False,
            'error': {
                'code': 'PARSE_ERROR',
                'message': f'Failed to parse document: {str(e)}',
                'details': {
                    'filename': os.path.basename(filepath),
                    'stage': 'document_parsing'
                }
            }
        }


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'markitdown-parser',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })


@app.route('/parse', methods=['POST'])
def parse():
    """
    Parse uploaded document and return markdown content

    Expected: multipart/form-data with 'file' field
    Returns: JSON with markdown content and metadata
    """
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': {
                'code': 'NO_FILE',
                'message': 'No file provided in request'
            }
        }), 400

    file = request.files['file']

    # Check if file has a name
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': {
                'code': 'EMPTY_FILENAME',
                'message': 'No file selected'
            }
        }), 400

    # Check file extension
    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_FILE_TYPE',
                'message': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }
        }), 400

    # Check file size
    file.seek(0, 2)  # Seek to end
    file_size = file.tell()
    file.seek(0)  # Reset to beginning

    if file_size > MAX_FILE_SIZE:
        return jsonify({
            'success': False,
            'error': {
                'code': 'FILE_TOO_LARGE',
                'message': f'File size ({file_size} bytes) exceeds maximum allowed size ({MAX_FILE_SIZE} bytes)'
            }
        }), 400

    # Save file temporarily
    filename = secure_filename(file.filename)
    temp_file = None

    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as temp_file:
            file.save(temp_file.name)
            temp_filepath = temp_file.name

        logger.info(f"Processing file: {filename} ({file_size} bytes)")

        # Parse the document
        result = parse_document(temp_filepath)

        return jsonify(result), 200 if result['success'] else 500

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': f'Internal server error: {str(e)}'
            }
        }), 500

    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
                logger.debug(f"Cleaned up temporary file: {temp_file.name}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file: {e}")


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return jsonify({
        'success': False,
        'error': {
            'code': 'FILE_TOO_LARGE',
            'message': f'File size exceeds maximum allowed size ({MAX_FILE_SIZE} bytes)'
        }
    }), 413


@app.errorhandler(500)
def internal_error(error):
    """Handle internal server errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        'success': False,
        'error': {
            'code': 'INTERNAL_ERROR',
            'message': 'Internal server error occurred'
        }
    }), 500


if __name__ == '__main__':
    logger.info(f"Starting MarkItDown Parser Service on port {PORT}")
    logger.info(f"Max file size: {MAX_FILE_SIZE} bytes")
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")

    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=os.getenv('DEBUG', 'false').lower() == 'true'
    )
