import { Component, signal, computed, inject } from '@angular/core';
import { IonicModule, AlertController, ModalController, ToastController, LoadingController } from '@ionic/angular';
import { Restaurante } from '../interface/restaurante';
import { RestauranteService } from '../services/restaurante.service';
import { AddRestauranteModalComponent } from '../components/add-restaurante-modal/add-restaurante-modal.component';
import restaurantesJSON from '../../assets/datos/restaurantes.json';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  // ############################### REGION DATOS ###############################

  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private modalCtrl = inject(ModalController);
  private restauranteService = inject(RestauranteService);

  // Restaurantes leídos del JSON local (usados para la importación a Firebase)
  restaurantes: Restaurante[] = restaurantesJSON as Restaurante[];

  // Signal principal con los restaurantes actualmente cargados (vacío hasta que el usuario pulsa "Cargar datos")
  restaurantesCargados = signal<Restaurante[]>([]);

  // true durante la carga de datos
  // H1 (VISIBILIDAD) - 1: Spinner y texto al pulsar Cargar para que el usuario sepa que está cargando
  cargando = signal(false);

  // H1 (VISIBILIDAD repetido) - 1: igual que con cargando, spinner y texto cuando se está importando
  // true durante la importación del JSON a Firebase
  importando = signal(false);

  // true cuando hay al menos un restaurante cargado
  hayDatos = computed(() => this.restaurantesCargados().length > 0);

  // Carga los restaurantes desde Firebase y muestra un toast de confirmación
  // H1 (VISIBILIDAD) - 3: Toasts para informar de éxito o fallo al cargar restaurantes
  // El toast de color danger no se cierra solo para llamar la atención del usuario sobre el error
  async cargarDatos() {
    this.cargando.set(true);
    try {
      const datos = await this.restauranteService.getAll();
      this.restaurantesCargados.set(datos);
      this.mostrarToast(`${datos.length} restaurantes cargados`, 'success');
    } catch {
      this.mostrarToast('Error al cargar los datos desde Firebase', 'danger');
    } finally {
      this.cargando.set(false);
    }
  }

  // Muestra un diálogo de confirmación antes de iniciar la importación
  // H5 (PREVENCIÓN DE ERRORES) - 2: El AlertController previene la importación accidental
  async confirmarImportacion() {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar importación',
      subHeader: `Se importarán ${this.restaurantes.length} restaurantes`,
      message: 'Los datos actuales de Firebase serán borrados y reemplazados con los del archivo local. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sí, importar', role: 'confirm', handler: () => this.importarJSON() }
      ]
    });
    await alert.present();
  }

  // Borra todos los datos de Firebase y sube los restaurantes del JSON local 
  async importarJSON() {
    this.importando.set(true);
    // H1 (VISIBILIDAD) - 2: Overlay para informar al usuario de procesos largos como borrar e importar datos
    const loading = await this.loadingCtrl.create({
      message: 'Borrando datos anteriores...',
      backdropDismiss: false
    });
    await loading.present();
    try {
      await this.restauranteService.deleteAll();
      loading.message = 'Subiendo restaurantes...';
      await this.restauranteService.addAll(this.restaurantes);
      await loading.dismiss();
      this.mostrarToast(`${this.restaurantes.length} restaurantes importados correctamente`, 'success');
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error al importar JSON:', error);
      const msg = error?.code === 'permission-denied'
        // H9 (RECONOCER, DIAGNOSTICAR Y RECUPERARSE DE ERRORES) - 1: Diagnóstico concreto (sin permisos en Firebase) para desarrolladores
        ? 'Sin permisos en Firebase. Revisa las reglas de seguridad.'
        // H9 (RECONOCER, DIAGNOSTICAR Y RECUPERARSE DE ERRORES) - 2: Diagnóstico general (problemas de red) para usuarios
        : 'Error al importar. Revisa tu conexión a internet.';
      this.mostrarToast(msg, 'danger');
    } finally {
      this.importando.set(false);
    }
  }

  // Muestra confirmación y borra el restaurante indicado de Firebase y de la lista local
  async borrarRestaurante(r: Restaurante) {
    // H3 (CONTROL Y LIBERTAD) - 1: Opción de cancelar antes de borrar con AlertController
    const alert = await this.alertCtrl.create({
      header: 'Confirmar borrado',
      subHeader: `¿Deseas borrar el restaurante ${r.documentName}?`,
      message: `Este proceso es irreversible`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar', role: 'confirm', cssClass: 'danger',
          handler: async () => {
            if (!r.id) {
              this.mostrarToast('No se puede borrar: el restaurante no tiene ID.', 'danger');
              return;
            }
            try {
              await this.restauranteService.delete(r.id);
              this.restaurantesCargados.update(lista => lista.filter(x => x.id !== r.id));
              this.mostrarToast(`${r.documentName} eliminado`, 'success');
            } catch {
              // H9 (RECONOCER, DIAGNOSTICAR Y RECUPERARSE DE ERRORES) - 3: Mensaje de error si ha habido problemas al borrar el restaurante
              this.mostrarToast('Error al borrar el restaurante', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Abre el modal para añadir un restaurante nuevo
  async abrirModalAnadir() {
    const modal = await this.modalCtrl.create({
      component: AddRestauranteModalComponent,
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      await this.cargarDatos();
    }
  }

  // Muestra un toast con el mensaje y color indicados
  // H4 (CONSISTENCIA Y ESTÁNDARES) - 2: Toasts con colores estándar (verde para éxito, rojo para peligro)
  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [{ text: 'X', role: 'cancel' }]
    });
    await toast.present();
  }


  // ############################### REGION FILTROS (estado general) ###############################

  textoBusqueda = signal('');

  // true si hay algún filtro activo (texto, territorio o localidades)
  hayFiltrosActivos = computed(() =>
    !!this.textoBusqueda() ||
    !!this.territorioSeleccionado() ||
    this.localidadesSeleccionadas().length > 0
  );

  // Resetea todos los filtros a sus valores iniciales
  // H3 (CONTROL Y LIBERTAD) - 2: Opción de limpiar todos los filtros
  limpiarTodosFiltros() {
    this.textoBusqueda.set('');
    this.territorioSeleccionado.set('');
    this.localidadesSeleccionadas.set([]);
  }

  // ############################### REGION TERRITORIOS ###############################

  territorioSeleccionado = signal('');

  // Lista de territorios únicos disponibles, ordenada alfabéticamente
  territoriosFiltrados = computed(() => {
    const territorios = this.restaurantesCargados().map(r => r.territory);
    return Array.from(new Set(territorios)).sort();
  });

  // Actualiza el territorio seleccionado y elimina las localidades que ya no pertenecen a él
  onTerritorioChange(value: string) {
    this.territorioSeleccionado.set(value);
    const nuevasLocalidades = this.localidadesSeleccionadas().filter(loc =>
      this.localidadesFiltradasPorTerritorio().includes(loc)
    );
    this.localidadesSeleccionadas.set(nuevasLocalidades);
  }

  // ############################### REGION LOCALIDADES ###############################

  localidadesSeleccionadas = signal<string[]>([]);

  // Lista de localidades únicas del territorio seleccionado (o de todos si no hay territorio), ordenada alfabéticamente
  localidadesFiltradasPorTerritorio = computed(() => {
    let lista = this.restaurantesCargados();
    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory?.toLowerCase().trim() === territorio);
    }
    const localities = lista.map(r => r.locality?.trim()).filter((l): l is string => !!l);
    return Array.from(new Set(localities)).sort();
  });

  // Actualiza las localidades seleccionadas con los valores del evento
  onLocalidadesChange(value: string[]) {
    this.localidadesSeleccionadas.set(value);
  }

  // ############################### REGION RESULTADOS ###############################

  // Lista filtrada de restaurantes según todos los filtros activos
  // H7 (FLEXIBILIDAD Y EFICIENCIA DE USO) - 2: Se pueden usar todos los filtros a la vez
  // gracias al computed restaurantesFiltrados, que se actualiza con los signals
  // textoBusqueda, territorioSeleccionado y localidadesSeleccionadas
  restaurantesFiltrados = computed(() => {
    let lista = this.restaurantesCargados();

    const texto = this.textoBusqueda().toLowerCase().trim();
    if (texto) {
      lista = lista.filter(r => r.documentName.toLowerCase().includes(texto));
    }

    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory.toLowerCase().trim() === territorio);
    }

    const seleccionadas = this.localidadesSeleccionadas();
    if (seleccionadas.length > 0) {
      lista = lista.filter(r => seleccionadas.includes(r.locality?.trim() || ''));
    }

    return lista;
  });

  // ############################### REGION AUXILIARES ###############################

  // Devuelve el número de estrellas Michelin (0 si no tiene o el valor no es numérico)
  estrellasMichelin(r: Restaurante): number {
    return Number(r.michelinStar) || 0;
  }

  // Devuelve el número de soles Repsol (0 si no tiene o el valor no es numérico)
  repsolSoles(r: Restaurante): number {
    return Number(r.repsolSun) || 0;
  }
}