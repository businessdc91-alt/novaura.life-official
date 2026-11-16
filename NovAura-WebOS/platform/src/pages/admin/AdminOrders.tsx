import { motion } from 'framer-motion';
import { Search, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { platformOrders } from '@/services/marketService';
import { formatPrice, formatDate } from '@/utils/format';

export default function AdminOrders() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
        Order Management
      </h1>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <Input
          type="text"
          placeholder="Search orders..."
          className="pl-12 py-6 bg-void-light border-white/10"
        />
      </div>

      <div className="bg-void-light border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-4 text-text-muted font-medium text-sm">Order</th>
              <th className="text-left px-6 py-4 text-text-muted font-medium text-sm">Buyer</th>
              <th className="text-left px-6 py-4 text-text-muted font-medium text-sm">Total</th>
              <th className="text-left px-6 py-4 text-text-muted font-medium text-sm">Status</th>
              <th className="text-left px-6 py-4 text-text-muted font-medium text-sm">Date</th>
            </tr>
          </thead>
          <tbody>
            {platformOrders.map((order, index) => (
              <motion.tr
                key={order.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-white/5 last:border-b-0 hover:bg-white/5"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-text-muted" />
                    <span className="font-medium text-text-primary">#{order.id}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-text-secondary">
                  User {order.buyerId}
                </td>
                <td className="px-6 py-4">
                  <span className="font-heading font-bold text-neon-cyan">
                    {formatPrice(order.totalAmount)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'completed' 
                      ? 'bg-neon-lime/20 text-neon-lime' 
                      : 'bg-yellow-400/20 text-yellow-400'
                  }`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-text-secondary">
                  {formatDate(order.createdAt)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

