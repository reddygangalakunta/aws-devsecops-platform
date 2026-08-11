.PHONY: help install test test-node test-python run-dev docker-up docker-down k8s-apply scan

help:
	@echo "DevSecOps Real-Time Platform Commands:"
	@echo "  make install        - Install dependencies for both Node.js and Python microservices"
	@echo "  make test           - Run all automated unit and integration tests"
	@echo "  make test-node      - Run Jest tests for Node.js gateway"
	@echo "  make test-python    - Run Pytest for Python analytics service"
	@echo "  make docker-up      - Build and run containers via Docker Compose (Node, Python, Prometheus)"
	@echo "  make docker-down    - Stop and remove Docker Compose containers"
	@echo "  make k8s-apply      - Apply Kubernetes manifests to cluster"
	@echo "  make k8s-delete     - Delete Kubernetes platform resources"

install:
	@echo "Installing Python dependencies..."
	cd services/python-service && python3 -m venv .venv && PIP_USER=0 .venv/bin/pip install -r requirements.txt
	@echo "Installing Node.js dependencies..."
	cd services/node-service && npm install

test: test-python test-node

test-node:
	@echo "Running Node.js tests..."
	cd services/node-service && npm test

test-python:
	@echo "Running Python tests..."
	PYTHONPATH=services/python-service services/python-service/.venv/bin/pytest -v services/python-service/tests

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

k8s-apply:
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/python-service-deployment.yaml
	kubectl apply -f k8s/node-service-deployment.yaml
	kubectl apply -f k8s/ingress.yaml

k8s-delete:
	kubectl delete -f k8s/ingress.yaml --ignore-not-found
	kubectl delete -f k8s/node-service-deployment.yaml --ignore-not-found
	kubectl delete -f k8s/python-service-deployment.yaml --ignore-not-found
	kubectl delete -f k8s/namespace.yaml --ignore-not-found
