from celery import Celery

from tripl.config import settings

celery_app = Celery("tripl")
celery_app.conf.broker_url = settings.rabbitmq_url
celery_app.conf.result_backend = None
celery_app.conf.task_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.timezone = "UTC"
celery_app.conf.broker_connection_retry_on_startup = True

celery_app.conf.beat_schedule = {
    "check-metrics-due": {
        "task": "tripl.worker.tasks.metrics.check_metrics_due",
        "schedule": 60.0,  # every 60 seconds
    },
}

# Import tasks so they are registered with the celery app
import tripl.worker.tasks.metrics  # noqa: F401, E402
import tripl.worker.tasks.scan  # noqa: F401, E402
