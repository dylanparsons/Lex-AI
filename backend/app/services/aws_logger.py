import os
import json
import uuid
import boto3
from datetime import datetime
from typing import Optional
from botocore.exceptions import ClientError, NoCredentialsError

S3_BUCKET = os.getenv("AWS_S3_BUCKET", "ai-dashboard-logs")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


def get_s3_client():
    """Build S3 client from env credentials (or IAM role in Lambda/EC2)."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def log_inference_to_s3(
    readings: list,
    anomalies: list,
    summary: str,
    recommendation: str,
    confidence: float,
) -> bool:
    """
    Write AI inference result to S3 as a structured JSON log.
    Key pattern: inference-logs/YYYY/MM/DD/<uuid>.json

    Returns True if successful, False otherwise (non-fatal — app continues).
    """
    now = datetime.utcnow()
    key = f"inference-logs/{now.strftime('%Y/%m/%d')}/{uuid.uuid4()}.json"

    payload = {
        "log_id": str(uuid.uuid4()),
        "timestamp": now.isoformat(),
        "input": {
            "reading_count": len(readings),
            "sensor_ids": list({r.get("sensor_id", r.sensor_id if hasattr(r, "sensor_id") else "unknown") for r in readings}),
        },
        "anomalies_detected": len(anomalies),
        "output": {
            "summary": summary,
            "recommendation": recommendation,
            "confidence": confidence,
        },
    }

    try:
        s3 = get_s3_client()
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(payload, indent=2),
            ContentType="application/json",
        )
        print(f"[S3 Logger] Logged inference to s3://{S3_BUCKET}/{key}")
        return True

    except NoCredentialsError:
        print("[S3 Logger] AWS credentials not configured — skipping S3 log")
        return False
    except ClientError as e:
        print(f"[S3 Logger] S3 error: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"[S3 Logger] Unexpected error: {e}")
        return False
