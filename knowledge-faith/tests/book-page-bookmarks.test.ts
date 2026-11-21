import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOK_PAGE_BOOKMARKS_KEY,
  BOOK_RESUME_KEY,
  buildBookReaderHash,
  parseBookReaderParams,
  parseLegacyBookResume,
  readBookPageBookmarks,
  removeBookPageBookmark,
  sameBookPageLocator,
  upsertBookPageBookmark,
  validateBookPageLocator,
  writeBookPageBookmarks,
} from '../src/lib/bookPageBookmark.ts';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('typed book-page bookmarks', () => {
  it('stores PDF and prepared-text pages as independent entries', () => {
    const storage = new MemoryStorage();
    const pdf = upsertBookPageBookmark(
      {
        itemId: 1001,
        representation: 'pdf',
        page: 12,
        lang: 'en',
        attachmentId: 'https://islamhouse.com/files/fixture.pdf',
        anchor: null,
        title: 'Fixture Book',
        publicationLanguage: 'en',
      },
      storage,
    );
    const text = upsertBookPageBookmark(
      {
        itemId: 1001,
        representation: 'text',
        page: 8,
        lang: 'en',
        attachmentId: null,
        anchor: 'b1',
        title: 'Fixture Book',
        publicationLanguage: 'en',
      },
      storage,
    );
    assert.equal(pdf.ok, true);
    assert.equal(text.ok, true);
    const list = readBookPageBookmarks(storage);
    assert.equal(list.length, 2);
    assert.equal(
      sameBookPageLocator(list[0]!, list[1]!),
      false,
    );
    assert.ok(list.some(item => item.representation === 'pdf' && item.page === 12));
    assert.ok(list.some(item => item.representation === 'text' && item.page === 8));
  });

  it('dedupes the same locator and keeps title saves keys untouched', () => {
    const storage = new MemoryStorage();
    storage.setItem('kf-saved-books', JSON.stringify([{ id: 9, title: 'Keep', language: 'en' }]));
    storage.setItem('kf-saved', JSON.stringify({ verses: ['2:255'], hadith: [] }));
    upsertBookPageBookmark(
      {
        itemId: 7,
        representation: 'text',
        page: 3,
        lang: 'ta',
        attachmentId: null,
        anchor: null,
        title: 'Tamil title',
        publicationLanguage: 'ta',
      },
      storage,
    );
    upsertBookPageBookmark(
      {
        itemId: 7,
        representation: 'text',
        page: 3,
        lang: 'ta',
        attachmentId: null,
        anchor: 'later',
        title: 'Tamil title again',
        publicationLanguage: 'ta',
      },
      storage,
    );
    assert.equal(readBookPageBookmarks(storage).length, 1);
    assert.ok(storage.getItem('kf-saved-books')?.includes('Keep'));
    assert.ok(storage.getItem('kf-saved')?.includes('2:255'));
    assert.notEqual(BOOK_PAGE_BOOKMARKS_KEY, 'kf-saved');
    assert.notEqual(BOOK_PAGE_BOOKMARKS_KEY, 'kf-saved-books');
    assert.equal(BOOK_RESUME_KEY, 'kf-book-page');
  });

  it('removes only the targeted PDF bookmark', () => {
    const storage = new MemoryStorage();
    upsertBookPageBookmark(
      {
        itemId: 1001,
        representation: 'pdf',
        page: 12,
        lang: 'en',
        attachmentId: 'https://islamhouse.com/files/a.pdf',
        anchor: null,
        title: 'A',
        publicationLanguage: 'en',
      },
      storage,
    );
    upsertBookPageBookmark(
      {
        itemId: 1001,
        representation: 'text',
        page: 8,
        lang: 'en',
        attachmentId: null,
        anchor: null,
        title: 'A',
        publicationLanguage: 'en',
      },
      storage,
    );
    const removed = removeBookPageBookmark(
      {
        itemId: 1001,
        representation: 'pdf',
        page: 12,
        lang: 'en',
        attachmentId: 'https://islamhouse.com/files/a.pdf',
      },
      storage,
    );
    assert.equal(removed.ok, true);
    const list = readBookPageBookmarks(storage);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.representation, 'text');
    assert.equal(list[0]?.page, 8);
  });

  it('rejects quarantined prepared-text bookmarks for 2843165', () => {
    const storage = new MemoryStorage();
    const result = upsertBookPageBookmark(
      {
        itemId: 2843165,
        representation: 'text',
        page: 1,
        lang: 'ta',
        attachmentId: null,
        anchor: null,
        title: 'Quarantined',
        publicationLanguage: 'ta',
      },
      storage,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'quarantined');
    assert.equal(readBookPageBookmarks(storage).length, 0);
    assert.equal(
      validateBookPageLocator({
        v: 1,
        itemId: 2843165,
        representation: 'text',
        page: 1,
        lang: 'ta',
        attachmentId: null,
        anchor: null,
        title: 'x',
        publicationLanguage: 'ta',
        savedAt: new Date().toISOString(),
      }),
      null,
    );
  });

  it('builds and parses reader links round-trip', () => {
    const hash = buildBookReaderHash({
      itemId: 42,
      representation: 'pdf',
      readerPage: 12,
      lang: 'si',
      attachmentId: 'https://islamhouse.com/files/si.pdf',
    });
    assert.equal(
      hash,
      '#/books/item/42?rep=pdf&readerPage=12&lang=si&att=https%3A%2F%2Fislamhouse.com%2Ffiles%2Fsi.pdf',
    );
    const qs = hash.slice(hash.indexOf('?') + 1);
    const parsed = parseBookReaderParams(new URLSearchParams(qs));
    assert.deepEqual(parsed, {
      representation: 'pdf',
      readerPage: 12,
      lang: 'si',
      attachmentId: 'https://islamhouse.com/files/si.pdf',
    });
  });

  it('treats legacy kf-book-page as resume-only, never a bookmark', () => {
    assert.deepEqual(parseLegacyBookResume({ id: 5, page: 3 }), { id: 5, page: 3 });
    assert.equal(parseLegacyBookResume({ id: 5 }), null);
    assert.equal(parseLegacyBookResume({ v: 1, itemId: 5, page: 3, representation: 'text', lang: 'en' }), null);
    const storage = new MemoryStorage();
    storage.setItem(BOOK_RESUME_KEY, JSON.stringify({ id: 5, page: 3 }));
    assert.equal(readBookPageBookmarks(storage).length, 0);
  });

  it('reports write failure without claiming persistence', () => {
    const failing: Storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    const result = writeBookPageBookmarks(
      [
        {
          v: 1,
          itemId: 1,
          representation: 'text',
          page: 1,
          lang: 'en',
          attachmentId: null,
          anchor: null,
          title: 't',
          publicationLanguage: 'en',
          savedAt: new Date().toISOString(),
        },
      ],
      failing,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, 'quota');
  });

  it('keeps cross-language editions distinct', () => {
    const storage = new MemoryStorage();
    upsertBookPageBookmark(
      {
        itemId: 200,
        representation: 'text',
        page: 1,
        lang: 'ta',
        attachmentId: null,
        anchor: null,
        title: 'Same title',
        publicationLanguage: 'ta',
      },
      storage,
    );
    upsertBookPageBookmark(
      {
        itemId: 201,
        representation: 'text',
        page: 1,
        lang: 'si',
        attachmentId: null,
        anchor: null,
        title: 'Same title',
        publicationLanguage: 'si',
      },
      storage,
    );
    assert.equal(readBookPageBookmarks(storage).length, 2);
  });

  it('binds PDF bookmarks to the displayed attachment identity, not a stale route att', () => {
    const storage = new MemoryStorage();
    const displayed = 'https://islamhouse.com/files/current.pdf';
    const stale = 'https://islamhouse.com/files/old.pdf';
    // Simulate reader policy: always upsert with the displayed file identity.
    upsertBookPageBookmark(
      {
        itemId: 55,
        representation: 'pdf',
        page: 12,
        lang: 'en',
        attachmentId: displayed,
        anchor: null,
        title: 'Displayed',
        publicationLanguage: 'en',
      },
      storage,
    );
    const list = readBookPageBookmarks(storage);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.attachmentId, displayed);
    assert.notEqual(list[0]?.attachmentId, stale);
    assert.equal(
      sameBookPageLocator(list[0]!, {
        itemId: 55,
        representation: 'pdf',
        page: 12,
        lang: 'en',
        attachmentId: stale,
      }),
      false,
    );
  });
});
