import pytest

from oakbt.data import store


def test_reads_credentials_from_the_environment(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://env.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "env-key")
    url, key = store.load_credentials()
    assert url == "https://env.supabase.co"
    assert key == "env-key"


def test_falls_back_to_env_local_file(monkeypatch, tmp_path):
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    env_file = tmp_path / ".env.local"
    env_file.write_text(
        "# a comment\n"
        "NEXT_PUBLIC_SUPABASE_URL=https://file.supabase.co\n"
        "SUPABASE_SERVICE_ROLE_KEY=file-key\n"
        "OTHER=ignored\n"
    )
    url, key = store.load_credentials(env_path=env_file)
    assert url == "https://file.supabase.co"
    assert key == "file-key"


def test_strips_quotes_and_whitespace_from_env_file_values(monkeypatch, tmp_path):
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    env_file = tmp_path / ".env.local"
    env_file.write_text(
        'NEXT_PUBLIC_SUPABASE_URL="https://quoted.supabase.co"\n'
        "SUPABASE_SERVICE_ROLE_KEY = 'quoted-key' \n"
    )
    url, key = store.load_credentials(env_path=env_file)
    assert url == "https://quoted.supabase.co"
    assert key == "quoted-key"


def test_environment_wins_over_the_file(monkeypatch, tmp_path):
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "env-key")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://env.supabase.co")
    env_file = tmp_path / ".env.local"
    env_file.write_text("SUPABASE_SERVICE_ROLE_KEY=file-key\n")
    url, key = store.load_credentials(env_path=env_file)
    assert key == "env-key"


def test_raises_a_named_error_when_the_key_is_missing(monkeypatch, tmp_path):
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://env.supabase.co")
    with pytest.raises(RuntimeError, match="SUPABASE_SERVICE_ROLE_KEY"):
        store.load_credentials(env_path=tmp_path / "missing.env")


def test_chunked_splits_evenly():
    assert list(store._chunked([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]
    assert list(store._chunked([], 2)) == []
