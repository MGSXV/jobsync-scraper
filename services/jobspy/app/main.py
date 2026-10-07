"""FastAPI sidecar wrapping JobSpy for JobSync.

Why this exists: JobSpy is a Python library whose hard dependencies (pandas,
curl_cffi) ship glibc manylinux wheels only, while JobSync's image is Alpine
(musl). Running it in its own Debian-based container avoids compiling both from
source, and keeps a scrape that blocks for minutes out of the web app's process.

Not exposed outside the compose network -- see docker-compose.yml, which
deliberately publishes no port for this service.
"""

from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from jobspy import scrape_jobs

from .normalize import normalize_frame
from .schema import ScrapeError, ScrapeRequest, ScrapeResponse, ScrapedJob

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("jobspy-service")

# Shared secret. The service binds to the compose-internal network only, but
# self-hosters expose things by accident, so the header is checked whenever a
# token is configured.
AUTH_TOKEN = os.environ.get("JOBSPY_TOKEN", "").strip()

# Per-site ceiling. One wedged board must not hold the whole request open --
# JobSync's own client timeout is the outer bound, this is the inner one.
SITE_TIMEOUT_S = int(os.environ.get("JOBSPY_SITE_TIMEOUT_S", "240"))

app = FastAPI(title="JobSync JobSpy service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "authRequired": bool(AUTH_TOKEN)}


def _authorize(token: str | None) -> None:
    if not AUTH_TOKEN:
        return
    # Compared with a plain != rather than compare_digest: the token travels on
    # a container-internal network and a timing oracle here is not the weak
    # link. Swap to hmac.compare_digest if this ever gets published.
    if token != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="invalid or missing token")


def _scrape_one_site(site: str, req: ScrapeRequest) -> pd.DataFrame:
    """Scrape a single board.

    JobSpy can fan out across sites itself, but it collects results with
    ``future.result()``, so one site raising would abort the whole batch. Going
    one site per call buys per-site error isolation and lets a board that
    returned nothing be reported as such -- the scrapers swallow their own
    failures and log, so a blocked board is otherwise indistinguishable from a
    search that genuinely matched nothing.
    """
    return scrape_jobs(
        site_name=[site],
        search_term=req.search_term,
        google_search_term=req.google_search_term,
        location=req.location,
        distance=req.distance,
        is_remote=req.is_remote,
        job_type=req.job_type,
        easy_apply=req.easy_apply,
        results_wanted=req.results_wanted,
        country_indeed=req.country_indeed,
        proxies=req.proxies,
        ca_cert=req.ca_cert,
        description_format=req.description_format,
        linkedin_company_ids=req.linkedin_company_ids,
        offset=req.offset,
        hours_old=req.hours_old,
        enforce_annual_salary=req.enforce_annual_salary,
        verbose=req.verbose,
        fetch_description=req.fetch_description,
    )


@app.post("/scrape", response_model=ScrapeResponse)
def scrape(
    req: ScrapeRequest,
    x_jobspy_token: str | None = Header(default=None, alias="X-JobSpy-Token"),
) -> ScrapeResponse:
    # Declared `def`, not `async def`: FastAPI runs sync endpoints in its
    # threadpool, so this blocking call does not stall the event loop.
    _authorize(x_jobspy_token)

    started = time.monotonic()
    log.info(
        "scrape: sites=%s term=%r location=%r wanted=%d descriptions=%s",
        req.sites,
        req.search_term,
        req.location,
        req.results_wanted,
        req.fetch_description,
    )

    jobs: list[ScrapedJob] = []
    errors: list[ScrapeError] = []

    with ThreadPoolExecutor(max_workers=len(req.sites)) as pool:
        futures = {pool.submit(_scrape_one_site, site, req): site for site in req.sites}
        for future, site in futures.items():
            try:
                frame = future.result(timeout=SITE_TIMEOUT_S)
            except FutureTimeout:
                log.warning("site %s exceeded %ss", site, SITE_TIMEOUT_S)
                errors.append(
                    ScrapeError(token=site, reason=f"timed out after {SITE_TIMEOUT_S}s")
                )
                continue
            except Exception as exc:  # noqa: BLE001 - one board must not sink the rest
                log.warning("site %s failed: %s", site, exc)
                errors.append(ScrapeError(token=site, reason=str(exc) or "scrape failed"))
                continue

            site_jobs = normalize_frame(frame)
            if not site_jobs:
                # Not strictly an error, but the only signal a user gets that a
                # board is rate-limiting them rather than simply having nothing.
                errors.append(ScrapeError(token=site, reason="returned no results"))
                continue
            log.info("site %s returned %d job(s)", site, len(site_jobs))
            jobs.extend(site_jobs)

    elapsed_ms = int((time.monotonic() - started) * 1000)
    log.info("scrape complete: %d job(s), %d error(s), %dms", len(jobs), len(errors), elapsed_ms)
    return ScrapeResponse(jobs=jobs, errors=errors, elapsed_ms=elapsed_ms)
