"""Request/response contract for the scrape endpoint.

Deliberately a thin, faithful mirror of ``jobspy.scrape_jobs`` keyword
arguments. Policy about *which* sites to offer a user lives in JobSync's UI,
not here -- this service stays as capable as the library it wraps.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# Mirrors jobspy.model.Site. Kept as a Literal (rather than importing the enum)
# so a JobSpy upgrade that adds a site fails loudly here instead of silently
# accepting a value the rest of the pipeline has never seen.
Site = Literal[
    "linkedin",
    "indeed",
    "zip_recruiter",
    "glassdoor",
    "google",
    "bayt",
    "naukri",
    "bdjobs",
]

JobType = Literal["fulltime", "parttime", "internship", "contract"]

DescriptionFormat = Literal["markdown", "html", "plain"]

# Ceilings the caller cannot raise. A misconfigured automation should not be
# able to launch an hour-long scrape against eight boards.
MAX_RESULTS_WANTED = 200
MAX_SITES = 8


class ScrapeRequest(BaseModel):
    sites: list[Site] = Field(min_length=1, max_length=MAX_SITES)
    search_term: Optional[str] = Field(default=None, max_length=500)
    google_search_term: Optional[str] = Field(default=None, max_length=500)
    location: Optional[str] = Field(default=None, max_length=200)
    distance: Optional[int] = Field(default=50, ge=0, le=200)
    is_remote: bool = False
    job_type: Optional[JobType] = None
    results_wanted: int = Field(default=15, ge=1, le=MAX_RESULTS_WANTED)
    hours_old: Optional[int] = Field(default=None, ge=1, le=24 * 90)
    country_indeed: str = "usa"
    offset: int = Field(default=0, ge=0)
    fetch_description: bool = True
    description_format: DescriptionFormat = "markdown"
    enforce_annual_salary: bool = False
    easy_apply: Optional[bool] = None
    linkedin_company_ids: Optional[list[int]] = Field(default=None, max_length=100)
    proxies: Optional[list[str]] = Field(default=None, max_length=50)
    ca_cert: Optional[str] = None
    verbose: int = Field(default=1, ge=0, le=2)

    @field_validator("sites")
    @classmethod
    def _dedupe_sites(cls, value: list[str]) -> list[str]:
        # dict.fromkeys preserves caller order; duplicate sites would otherwise
        # be scraped twice and double every result.
        return list(dict.fromkeys(value))


class ScrapedSalary(BaseModel):
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    interval: Optional[str] = None
    currency: Optional[str] = None
    source: Optional[str] = None
    # Pre-formatted for display, e.g. "$120,000 - $150,000/yr". Built here so
    # the formatting rules live next to the raw numbers that justify them.
    text: Optional[str] = None


class ScrapedJob(BaseModel):
    site: str
    title: str
    company: Optional[str] = None
    company_url: Optional[str] = None
    job_url: str
    job_url_direct: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    job_type: Optional[str] = None
    date_posted: Optional[str] = None
    is_remote: Optional[bool] = None
    job_level: Optional[str] = None
    company_industry: Optional[str] = None
    company_logo: Optional[str] = None
    work_from_home_type: Optional[str] = None
    skills: Optional[str] = None
    salary: ScrapedSalary = Field(default_factory=ScrapedSalary)


class ScrapeError(BaseModel):
    # `token` rather than `site` so the shape lines up with JobSync's existing
    # per-board error list and needs no special-casing in the run logger.
    token: str
    reason: str


class ScrapeResponse(BaseModel):
    jobs: list[ScrapedJob]
    errors: list[ScrapeError]
    elapsed_ms: int
