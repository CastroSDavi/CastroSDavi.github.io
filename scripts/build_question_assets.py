#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Utilities to manage MedQuiz question data.

This script lets you keep a human-friendly source of questions while still
producing the normalized JSON files that the front-end uses today.

Typical usage:
    python scripts/build_question_assets.py build
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

DEFAULT_SOURCE_PATH = Path("content/questions/banco_perguntas.json")
DEFAULT_PERGUNTAS_PATH = Path("assets/data/perguntas.json")
DEFAULT_OPCOES_PATH = Path("assets/data/opcoes_resposta.json")
DEFAULT_CATEGORIAS_PATH = Path("assets/data/categorias.json")
DEFAULT_CATEGORY_SLUG_PATH = Path("content/questions/categorias_slugs.json")


class BuildError(RuntimeError):
    """Raised when the input data fails validation."""


@dataclass
class CategoryMapping:
    slug_to_id: Dict[str, int]
    id_to_slug: Dict[int, str]


@dataclass
class BuildConfig:
    source_path: Path
    perguntas_path: Path
    opcoes_path: Path
    categorias_path: Path
    category_slug_path: Path


def slugify(value: str) -> str:
    """Generate a filesystem-friendly slug from arbitrary text."""

    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return cleaned or "item"


def load_category_mapping(config: BuildConfig) -> CategoryMapping:
    if config.category_slug_path.exists():
        with config.category_slug_path.open(encoding="utf-8") as fh:
            slug_map_data = json.load(fh)
        slug_to_id = {slug: int(cat_id) for slug, cat_id in slug_map_data.items()}
    else:
        slug_to_id = {}

    with config.categorias_path.open(encoding="utf-8") as fh:
        categorias = json.load(fh)

    id_to_slug: Dict[int, str] = {}
    for item in categorias:
        cat_id = int(item["id_categoria"])
        if cat_id in id_to_slug:
            continue

        existing_slug = next((slug for slug, mapped_id in slug_to_id.items() if mapped_id == cat_id), None)
        if existing_slug:
            id_to_slug[cat_id] = existing_slug
            continue

        base_slug = slugify(item["nome_categoria"])
        slug = base_slug
        if slug in slug_to_id and slug_to_id[slug] != cat_id:
            slug = f"{slug}-{cat_id}"
        slug_to_id[slug] = cat_id
        id_to_slug[cat_id] = slug

    sorted_mapping = dict(sorted(slug_to_id.items(), key=lambda kv: kv[0]))
    config.category_slug_path.parent.mkdir(parents=True, exist_ok=True)
    with config.category_slug_path.open("w", encoding="utf-8") as fh:
        json.dump(sorted_mapping, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    return CategoryMapping(slug_to_id=sorted_mapping, id_to_slug=id_to_slug)


def load_source_questions(source_path: Path) -> Tuple[dict, List[dict]]:
    if not source_path.exists():
        raise BuildError(f"Fonte de perguntas não encontrada em {source_path}")

    with source_path.open(encoding="utf-8") as fh:
        data = json.load(fh)

    if isinstance(data, dict):
        metadata = data.get("metadata", {})
        questions = data.get("questions")
        if questions is None:
            raise BuildError("Arquivo de origem precisa conter a chave 'questions'.")
    elif isinstance(data, list):
        metadata = {}
        questions = data
    else:
        raise BuildError("Estrutura do arquivo de origem desconhecida. Use lista ou objeto com 'questions'.")

    if not isinstance(questions, list):
        raise BuildError("'questions' deve ser uma lista.")

    return metadata, questions


def ensure_question_ids(questions: Sequence[dict]) -> bool:
    used_ids = set()
    next_id = 1
    mutated = False

    for question in questions:
        qid = question.get("id")
        if qid is None:
            continue
        if not isinstance(qid, int):
            raise BuildError(f"ID da pergunta inválido: {qid!r}")
        if qid in used_ids:
            raise BuildError(f"ID da pergunta duplicado: {qid}")
        used_ids.add(qid)
        next_id = max(next_id, qid + 1)

    for question in questions:
        if question.get("id") is None:
            while next_id in used_ids:
                next_id += 1
            question["id"] = next_id
            used_ids.add(next_id)
            next_id += 1
            mutated = True

    return mutated


def ensure_option_ids(questions: Sequence[dict]) -> bool:
    used_ids = set()
    next_id = 1
    mutated = False

    for question in questions:
        for option in question.get("options", []):
            oid = option.get("id")
            if oid is None:
                continue
            if not isinstance(oid, int):
                raise BuildError(f"ID de opção inválido: {oid!r}")
            if oid in used_ids:
                raise BuildError(f"ID de opção duplicado: {oid}")
            used_ids.add(oid)
            next_id = max(next_id, oid + 1)

    for question in questions:
        for option in question.get("options", []):
            if option.get("id") is None:
                while next_id in used_ids:
                    next_id += 1
                option["id"] = next_id
                used_ids.add(next_id)
                next_id += 1
                mutated = True

    return mutated


def deduplicate(seq: Iterable[int]) -> List[int]:
    seen = set()
    result = []
    for item in seq:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def build_outputs(config: BuildConfig) -> None:
    metadata, questions = load_source_questions(config.source_path)
    mutated = False

    mutated |= ensure_question_ids(questions)
    mutated |= ensure_option_ids(questions)

    mapping = load_category_mapping(config)

    perguntas_output: List[dict] = []
    opcoes_output: List[dict] = []

    for index, question in enumerate(questions, start=1):
        qid = question.get("id")
        if not isinstance(qid, int):
            raise BuildError(f"Pergunta na posição {index} sem ID válido.")

        texto = question.get("texto") or question.get("texto_pergunta")
        if not texto:
            raise BuildError(f"Pergunta com ID {qid} está sem 'texto'.")

        dificuldade = question.get("nivel_dificuldade")
        if not dificuldade:
            raise BuildError(f"Pergunta com ID {qid} está sem 'nivel_dificuldade'.")

        categorias = question.get("categorias", [])
        if not isinstance(categorias, list):
            raise BuildError(f"Pergunta com ID {qid} possui 'categorias' inválidas.")

        categoria_ids: List[int] = []
        categoria_slugs: List[str] = []
        for raw in categorias:
            if isinstance(raw, int):
                cat_id = raw
            elif isinstance(raw, str):
                key = raw.strip()
                if not key:
                    continue
                if key.isdigit():
                    cat_id = int(key)
                else:
                    if key not in mapping.slug_to_id:
                        raise BuildError(f"Categoria '{key}' não está mapeada (pergunta ID {qid}).")
                    cat_id = mapping.slug_to_id[key]
            elif isinstance(raw, dict):
                if "id" in raw:
                    cat_id = int(raw["id"])
                elif "slug" in raw:
                    slug_value = raw["slug"]
                    if slug_value not in mapping.slug_to_id:
                        raise BuildError(f"Categoria '{slug_value}' não está mapeada (pergunta ID {qid}).")
                    cat_id = mapping.slug_to_id[slug_value]
                else:
                    raise BuildError(f"Categoria inválida na pergunta ID {qid}: {raw}")
            else:
                raise BuildError(f"Categoria inválida na pergunta ID {qid}: {raw}")

            if cat_id not in mapping.id_to_slug:
                raise BuildError(f"Categoria ID {cat_id} não encontrada no catálogo (pergunta ID {qid}).")

            categoria_ids.append(cat_id)
            categoria_slugs.append(mapping.id_to_slug[cat_id])

        categoria_ids = deduplicate(categoria_ids)
        categoria_slugs = deduplicate(categoria_slugs)

        if categoria_slugs != question.get("categorias"):
            question["categorias"] = categoria_slugs
            mutated = True

        referencia = question.get("referencia_bibliografica") or ""
        explicacao = question.get("explicacao_resposta") or ""
        ativa = bool(question.get("ativa", True))

        perguntas_output.append(
            {
                "id_pergunta": qid,
                "texto_pergunta": texto,
                "referencia_bibliografica": referencia,
                "categoria_ids": categoria_ids,
                "nivel_dificuldade": dificuldade,
                "explicacao_resposta": explicacao,
                "ativa": ativa,
            }
        )

        options = question.get("options", [])
        if not options:
            raise BuildError(f"Pergunta ID {qid} precisa de pelo menos uma opção de resposta.")

        for idx, option in enumerate(options, start=1):
            ordem = option.get("ordem")
            if not isinstance(ordem, int) or ordem < 1 or ordem != idx:
                option["ordem"] = idx
                ordem = idx
                mutated = True

            oid = option.get("id")
            if not isinstance(oid, int):
                raise BuildError(f"Opção da pergunta ID {qid} está sem ID válido.")

            texto_opcao = option.get("texto") or option.get("texto_opcao")
            if not texto_opcao:
                raise BuildError(f"Opção ID {oid} da pergunta ID {qid} está sem texto.")

            correta_value = option.get("correta")
            if correta_value is None:
                correta_value = option.get("eh_correta", False)
            correta = bool(correta_value)

            opcoes_output.append(
                {
                    "id_opcao_resposta": oid,
                    "id_pergunta": qid,
                    "texto_opcao": texto_opcao,
                    "eh_correta": correta,
                    "ordem_exibicao": ordem,
                }
            )

    perguntas_output.sort(key=lambda item: item["id_pergunta"])
    opcoes_output.sort(key=lambda item: item["id_opcao_resposta"])

    config.perguntas_path.parent.mkdir(parents=True, exist_ok=True)
    with config.perguntas_path.open("w", encoding="utf-8") as fh:
        json.dump(perguntas_output, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    config.opcoes_path.parent.mkdir(parents=True, exist_ok=True)
    with config.opcoes_path.open("w", encoding="utf-8") as fh:
        json.dump(opcoes_output, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    if mutated:
        payload = {"metadata": metadata, "questions": questions} if metadata else questions
        with config.source_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")


def export_source(config: BuildConfig) -> None:
    with config.perguntas_path.open(encoding="utf-8") as fh:
        perguntas = json.load(fh)
    with config.opcoes_path.open(encoding="utf-8") as fh:
        opcoes = json.load(fh)

    mapping = load_category_mapping(config)
    id_to_slug = mapping.id_to_slug

    options_by_question: Dict[int, List[dict]] = defaultdict(list)
    for option in opcoes:
        options_by_question[int(option["id_pergunta"])].append(option)

    questions: List[dict] = []
    for pergunta in perguntas:
        qid = int(pergunta["id_pergunta"])
        slug_base = slugify(pergunta["texto_pergunta"])
        code = f"{slug_base}-{qid}" if slug_base else f"pergunta-{qid}"

        categorias = [id_to_slug.get(int(cid), str(cid)) for cid in pergunta.get("categoria_ids", [])]

        question_entry = {
            "id": qid,
            "code": code,
            "texto": pergunta["texto_pergunta"],
            "referencia_bibliografica": pergunta.get("referencia_bibliografica", ""),
            "categorias": categorias,
            "nivel_dificuldade": pergunta.get("nivel_dificuldade"),
            "explicacao_resposta": pergunta.get("explicacao_resposta", ""),
            "ativa": bool(pergunta.get("ativa", True)),
            "options": [],
        }

        stored_options = sorted(options_by_question.get(qid, []), key=lambda item: item.get("ordem_exibicao", 0))
        for opt in stored_options:
            option_entry = {
                "id": int(opt["id_opcao_resposta"]),
                "texto": opt["texto_opcao"],
                "correta": bool(opt.get("eh_correta")),
                "ordem": int(opt.get("ordem_exibicao", len(question_entry["options"]) + 1)),
            }
            question_entry["options"].append(option_entry)

        questions.append(question_entry)

    payload = {
        "metadata": {"format": "question-bank", "version": 1},
        "questions": questions,
    }

    config.source_path.parent.mkdir(parents=True, exist_ok=True)
    with config.source_path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gerencia dados de perguntas do MedQuiz")
    subparsers = parser.add_subparsers(dest="command")

    build_parser = subparsers.add_parser("build", help="Gera os arquivos JSON normalizados a partir da fonte consolidada.")
    build_parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_PATH)
    build_parser.add_argument("--perguntas", type=Path, default=DEFAULT_PERGUNTAS_PATH)
    build_parser.add_argument("--opcoes", type=Path, default=DEFAULT_OPCOES_PATH)
    build_parser.add_argument("--categorias", type=Path, default=DEFAULT_CATEGORIAS_PATH)
    build_parser.add_argument("--category-slugs", dest="category_slugs", type=Path, default=DEFAULT_CATEGORY_SLUG_PATH)

    export_parser = subparsers.add_parser("export-source", help="Reconstrói a fonte consolidada a partir dos JSONs normalizados.")
    export_parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_PATH)
    export_parser.add_argument("--perguntas", type=Path, default=DEFAULT_PERGUNTAS_PATH)
    export_parser.add_argument("--opcoes", type=Path, default=DEFAULT_OPCOES_PATH)
    export_parser.add_argument("--categorias", type=Path, default=DEFAULT_CATEGORIAS_PATH)
    export_parser.add_argument("--category-slugs", dest="category_slugs", type=Path, default=DEFAULT_CATEGORY_SLUG_PATH)

    parser.set_defaults(command="build")

    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    config = BuildConfig(
        source_path=args.source,
        perguntas_path=args.perguntas,
        opcoes_path=args.opcoes,
        categorias_path=args.categorias,
        category_slug_path=args.category_slugs,
    )

    try:
        if args.command == "export-source":
            export_source(config)
        else:
            build_outputs(config)
    except BuildError as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())