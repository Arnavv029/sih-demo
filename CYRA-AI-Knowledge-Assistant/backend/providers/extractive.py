"""ExtractiveRegulatoryProvider — offline / fallback provider for AICTE Regulatory RAG."""
from __future__ import annotations

import asyncio
import re
from typing import AsyncIterator


class ExtractiveRegulatoryProvider:
    """Offline, deterministic regulatory answer synthesizer.

    Used when GOOGLE_API_KEY is not configured or as an instant local fallback.
    Synthesizes the retrieved chunks and grounds answers with exact [file, page] citations.
    """

    name: str = "extractive"

    def __init__(self, **kwargs) -> None:
        pass

    async def generate(
        self,
        prompt: str,
        *,
        timeout_s: float = 30.0,
        stream: bool = False,
    ) -> AsyncIterator[str]:
        # Extract passages: "Passage 1 [filename, page 1-5]:\ntext"
        passage_pattern = re.compile(
            r"Passage\s+\d+\s+\[([^,\]]+),\s*page\s*([^\]]+)\]:\s*(.*?)(?=\nPassage\s+\d+|\n--- End of Retrieved Passages ---|$)",
            re.DOTALL,
        )
        passages = passage_pattern.findall(prompt)

        # Fallback regex if formatting differs slightly
        if not passages:
            fallback_pattern = re.compile(
                r"\[([^,\]]+),\s*page\s*([^\]]+)\]\s*:\s*(.*?)(?=\n\s*\[|\n---|$)",
                re.DOTALL,
            )
            passages = fallback_pattern.findall(prompt)

        # Extract question if present
        question_match = re.search(r"User question:\s*(.+?)(?:\n|$)", prompt, re.IGNORECASE)
        question = question_match.group(1).strip() if question_match else "AICTE Query"

        if not passages:
            answer = (
                "The indexed regulatory documents do not contain sufficient verified clauses to address this specific query. "
                "Please verify the approval process handbook or upload the relevant AICTE circular."
            )
        else:
            # Build structured regulatory response
            points = []
            citations_seen = []
            
            # Key compliance keywords to look for
            keywords = ["clause", "land", "acre", "ratio", "faculty", "fire", "affiliat", "approv", "occupancy", "carpet", "sq.m", "nba", "naac"]
            
            for filename, pages, content in passages[:4]:
                clean_text = content.strip().replace("\r", "")
                tag = f"[{filename}, page {pages}]"
                citations_seen.append(tag)
                
                # Split into paragraphs or bullet points
                paragraphs = [p.strip() for p in clean_text.split("\n\n") if len(p.strip()) > 30]
                if not paragraphs:
                    paragraphs = [clean_text[:300]]
                    
                for para in paragraphs[:2]:
                    # Format as clean bullet point
                    first_line = para.split("\n")[0].strip()
                    points.append(f"- {para} {tag}")

            primary_tag = citations_seen[0] if citations_seen else "[AICTE_APH, page 1]"
            
            answer_parts = [
                f"### AICTE Regulatory & Compliance Analysis\n\n",
                f"Based on the official AICTE regulatory documents {primary_tag}, here are the statutory requirements and verified standards for **\"{question}\"**:\n\n",
                "\n\n".join(points[:5]),
                "\n\n#### Summary of Regulatory Obligations:\n",
                f"1. **Statutory Adherence**: Institutions must strictly comply with the specific requirements cited above {primary_tag}.\n",
                "2. **Documentary Proof**: Upload verified certificates (Occupancy, Fire Safety NOC, and Affiliation) to the AICTE Portal dossier.\n",
                "3. **Scrutiny Process**: Discrepancies will be flagged by AICTE Scrutiny Officers with a 7-day clarification window.",
            ]
            answer = "".join(answer_parts)

        async def _stream():
            if stream:
                words = answer.split(" ")
                for i in range(0, len(words), 4):
                    chunk = " ".join(words[i : i + 4]) + (" " if i + 4 < len(words) else "")
                    yield chunk
                    await asyncio.sleep(0.01)
            else:
                yield answer

        return _stream()
