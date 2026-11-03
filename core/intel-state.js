import { clone, fail, number, text } from './model.js';
import { moneyValue } from './settings.js';
import { imageData } from './image-data.js';
export const intelCategories = ['Pista', 'Personagem', 'Lugar', 'Missão', 'Segredo'];
export function validateIntel(item, { redacted = false } = {}) {
  text(item.id, 'ID da informação', 100, true);
  text(item.title, 'Título', 200, true);
  text(item.teaser || '', 'Apresentação', 3000);
  if (!intelCategories.includes(item.category)) fail('Categoria de informação inválida.');
  number(item.xp_cost, 'Custo em XP', 0, 1000000);
  moneyValue(item.money_cost, 'Custo em dinheiro');
  if (item.money_cost < 0) fail('O custo não pode ser negativo.');
  imageData(item.cover || '');
  if (!redacted) {
    text(item.secret, 'Conteúdo da informação', 30000, true);
    if (!Array.isArray(item.images || []) || (item.images || []).length > 6)
      fail('Use até seis imagens na informação.');
    for (const image of item.images || []) imageData(image);
  }
  if (item.purchase) {
    text(item.purchase.character_name, 'Personagem comprador', 150, true);
    text(item.purchase.account_name, 'Jogador comprador', 100, true);
    number(item.purchase.xp_paid, 'XP pago');
    moneyValue(item.purchase.money_paid, 'Dinheiro pago');
    if (item.purchase.money_paid < 0) fail('Pagamento inválido.');
  }
  return item;
}
export function publicIntel(item, actor) {
  const output = Object.fromEntries(
    [
      'id',
      'title',
      'teaser',
      'category',
      'cover',
      'xp_cost',
      'money_cost',
      'purchase',
      '_revision',
      'created_at',
      'updated_at',
      'created_by'
    ].map((k) => [k, clone(item[k])])
  );
  output.revealed = !!item.purchase;
  if (actor.role === 'admin' || item.purchase) {
    output.secret = item.secret;
    output.images = clone(item.images || []);
  }
  return output;
}
